import { NextRequest, NextResponse } from "next/server";
import { pplxComplete } from "@/lib/perplexity";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { content, title } = (await req.json()) as {
      content?: string;
      title?: string;
    };
    if (!content) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    const prompt = `You are summarising a source titled "${title || "Untitled"}" for a research notebook.

Write a tight, faithful summary in the SAME language the source is in:
- 3 to 5 sentences of overview
- A short "Key topics:" list with 3 to 7 short comma-separated tags

Source:
${content.slice(0, 20000)}`;
    const { content: result } = await pplxComplete(prompt, {
      model: "sonar",
      webSearch: false,
      temperature: 0.2,
      maxTokens: 600,
    });
    const topicMatch = result.match(/Key topics:?\s*([^\n]+)/i);
    const topics = topicMatch
      ? topicMatch[1]
          .split(/[,;•]/)
          .map((s) => s.trim().replace(/[.*]+$/g, ""))
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return NextResponse.json({ summary: result, topics });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
