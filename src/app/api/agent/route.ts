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

    return NextResponse.json({
      id: final.id,
      status: final.status,
      model: final.model,
      content: final.output_text ?? "",
      output: final.output ?? [],
      usage: final.usage,
      error: final.error,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
