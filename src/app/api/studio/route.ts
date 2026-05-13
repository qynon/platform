import { NextRequest, NextResponse } from "next/server";
import { pplxChat } from "@/lib/perplexity";
import { buildSystemPrompt } from "@/lib/grounding";
import type { Source, StudioArtifactKind } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface StudioBody {
  kind: StudioArtifactKind;
  sources: Source[];
  options?: Record<string, string | number | boolean>;
  customPrompt?: string;
}

const KIND_INSTRUCTIONS: Record<StudioArtifactKind, string> = {
  report: `Produce a structured Markdown report with: an executive summary, 3-6 themed sections each with a short H2 heading, key findings, and a conclusion. Cite source numbers inline as [N].`,
  faq: `Produce a Markdown FAQ with 8-15 questions grouped under H2 topic headings. Each answer is 2-4 sentences, grounded in the sources with [N] citations.`,
  "study-guide": `Produce a Markdown study guide with: Learning objectives, Key concepts (definitions), Key questions (open-ended), Glossary (terms + definitions). Cite [N] inline.`,
  briefing: `Produce a one-page Markdown briefing document with: Background, Key facts (bullet list), Implications, Open questions, Recommended next steps. Cite [N] inline.`,
  "data-table": `Output a single GitHub-flavored Markdown table that organises the most useful structured information from the sources. First row is the header. Add a short caption above. Do not add commentary after the table.`,
  mindmap: `Output a Markmap-compatible nested Markdown outline (only headings and bullets — no paragraphs). Single H1 root, then H2 for main branches, then nested bullets for sub-ideas. 3-5 levels deep, 30-80 leaf nodes total.`,
  flashcards: `Output a JSON array of flashcards: [{"front":"...","back":"...","explain":"..."}, ...]. Front = short question or term. Back = concise answer. Explain = optional 2-3 sentence elaboration. No prose outside JSON.`,
  quiz: `Output a JSON array of quiz questions: [{"q":"...","choices":["a","b","c","d"],"answer":0,"explain":"...","hint":"..."}, ...]. answer is the 0-based index. No prose outside JSON.`,
  slides: `Output JSON {"title":"Deck Title","slides":[{"title":"...","bullets":["...","..."],"notes":"..."}, ...]} with 8-14 slides. No prose outside JSON.`,
  infographic: `Output a self-contained HTML document for a one-page infographic (no external JS, inline CSS only). Should fit a 1080x1920 portrait canvas by default, but use responsive units. Use ONLY safe HTML/CSS, no scripts.`,
  "audio-overview": `Write a podcast-style dialogue script between two hosts named Алия and Дамир (or similar Kazakh names) who discuss the sources in a friendly, curious tone. Format as:
Алия: ...
Дамир: ...
Алия: ...
Use Kazakh by default unless the source is in another language. 10-15 exchanges. Add bracketed stage directions sparingly like [pause] or [laughs].`,
  "video-overview": `Write a JSON script for a narrated visual deep-dive video: {"title":"...","scenes":[{"narration":"...","visual":"description of on-screen visual","duration_sec":6}, ...]} with 8-15 scenes.`,
  practice: `(handled by /api/practice — should not be routed through /api/studio)`,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StudioBody;
    const sources = body.sources.filter((s) => s.enabled && s.content.trim());
    if (sources.length === 0) {
      return NextResponse.json(
        { error: "Add at least one enabled source first." },
        { status: 400 },
      );
    }
    const { systemPrompt } = buildSystemPrompt(sources, "default");
    const instr = KIND_INSTRUCTIONS[body.kind];
    const optionStr = body.options
      ? `User options: ${JSON.stringify(body.options)}`
      : "";
    const customPrompt = body.customPrompt?.trim()
      ? `User extra instructions: ${body.customPrompt}`
      : "";

    const userPrompt = `Task: Generate a ${body.kind}.\n\n${instr}\n\n${optionStr}\n${customPrompt}\n\nUse ONLY the SOURCES in the system message. Reply in the dominant language of the sources unless the user requested otherwise.`;

    const result = await pplxChat({
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      webSearch: false,
      maxTokens: 3500,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      body: text,
      prompt: userPrompt,
      kind: body.kind,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
