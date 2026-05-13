import { NextRequest, NextResponse } from "next/server";
import { pplxChat, type PplxMessage } from "@/lib/perplexity";
import {
  buildSystemPrompt,
  buildImageAttachments,
  extractCitations,
} from "@/lib/grounding";
import type { Source, ConversationalStyle, ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  sources: Source[];
  messages: Pick<ChatMessage, "role" | "content">[];
  style?: ConversationalStyle;
  question: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    const style = body.style ?? "default";
    const { systemPrompt, sourceBlocks } = buildSystemPrompt(body.sources, style);

    const enabled = body.sources.filter((s) => s.enabled);

    // If any enabled source is an image with a data URI, send the request as
    // a multimodal message so the model can actually see it.
    const visionContent = buildImageAttachments(body.sources, body.question);
    const userMessage: PplxMessage = visionContent
      ? { role: "user", content: visionContent }
      : { role: "user", content: body.question };

    const messages: PplxMessage[] = [
      { role: "system", content: systemPrompt },
      ...body.messages.slice(-10).map(
        (m): PplxMessage => ({
          role: m.role,
          content: m.content,
        }),
      ),
      userMessage,
    ];

    const result = await pplxChat({
      model: "sonar-pro",
      messages,
      temperature: 0.2,
      webSearch: enabled.length === 0,
      maxTokens: 2000,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    const citations = extractCitations(text, sourceBlocks, body.sources);

    return NextResponse.json({
      content: text,
      citations,
      webCitations: result.citations ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
