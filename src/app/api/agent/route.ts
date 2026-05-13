import { NextRequest, NextResponse } from "next/server";
import {
  callAgent,
  pollAgent,
  type AgentModel,
  type AgentPreset,
  type AgentMessage,
  type AgentTool,
  type AgentInputBlock,
} from "@/lib/agent";
import { buildSystemPrompt } from "@/lib/grounding";
import type { Source } from "@/lib/types";

interface AgentOutputBlock {
  type?: string;
  text?: string;
  content?: Array<{ type?: string; text?: string }>;
}

function extractText(final: {
  output_text?: string;
  output?: Array<Record<string, unknown>>;
}): string {
  if (typeof final.output_text === "string" && final.output_text.length > 0) {
    return final.output_text;
  }
  const out = final.output ?? [];
  const parts: string[] = [];
  for (const evt of out as AgentOutputBlock[]) {
    if (Array.isArray(evt.content)) {
      for (const piece of evt.content) {
        if (typeof piece.text === "string") parts.push(piece.text);
      }
    } else if (typeof evt.text === "string") {
      parts.push(evt.text);
    }
  }
  return parts.join("\n").trim();
}

export const runtime = "nodejs";
export const maxDuration = 300;

interface AgentBody {
  sources: Source[];
  question: string;
  model?: AgentModel;
  preset?: AgentPreset;
  tools?: AgentTool[];
  /** If true, run as a background task and poll up to ~2 minutes. */
  background?: boolean;
}

/**
 * Hits the Perplexity Agent API. Compared to /api/chat this:
 *   - lets the caller pick which underlying model / preset to use
 *     (OpenAI, Anthropic, Google, xAI, Perplexity, ...);
 *   - lets the model decide when to call tools (web_search, fetch_url,
 *     finance_search, people_search);
 *   - supports image attachments via input_image content blocks;
 *   - returns rich `usage` (token counts + USD cost).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AgentBody;
    const { systemPrompt } = buildSystemPrompt(body.sources, "default");

    // Build the multimodal "input" for the agent: text question + any
    // enabled image sources attached as input_image blocks.
    const imageBlocks: AgentInputBlock[] = body.sources
      .filter((s) => s.enabled && s.kind === "image" && s.imageDataUri)
      .slice(0, 5)
      .map((s) => ({
        type: "input_image" as const,
        image_url: s.imageDataUri!,
      }));

    const userBlocks: AgentInputBlock[] = [
      { type: "input_text", text: body.question },
      ...imageBlocks,
    ];

    const input: AgentMessage[] = [
      {
        role: "user",
        content: userBlocks,
      },
    ];

    const res = await callAgent({
      model: body.model,
      preset: body.preset,
      input,
      instructions: systemPrompt,
      tools: body.tools,
      background: body.background,
      max_output_tokens: 4096,
    });

    // If the API returned a background task, poll it.
    const final =
      res.status === "in_progress" || res.status === "queued"
        ? await pollAgent(res.id, { attempts: 60, delayMs: 2000 })
        : res;

    // Some tiers return the answer flat in `output_text`; others bury it in
    // `output[].content[].text` (an array of typed message events). Walk the
    // output structure and concatenate text fragments so the UI gets a single
    // string no matter which shape upstream uses.
    const flatText = extractText(final);

    return NextResponse.json({
      id: final.id,
      status: final.status,
      model: final.model,
      content: flatText,
      output: final.output ?? [],
      usage: final.usage,
      error: final.error,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // Translate upstream 400s about unsupported models into a friendlier hint
    // so the UI can show "this model is unavailable on your tier" instead of
    // a generic 500.
    if (raw.includes("is not supported")) {
      return NextResponse.json(
        {
          error:
            "Бұл модель тарифте қолжетімсіз. Басқа модельді таңдаңыз.",
          upstream: raw,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: raw }, { status: 500 });
  }
}
