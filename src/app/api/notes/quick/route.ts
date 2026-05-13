import { NextRequest, NextResponse } from "next/server";
import { pplxChat } from "@/lib/perplexity";
import type { Note, Source } from "@/lib/types";
import { buildSystemPrompt } from "@/lib/grounding";

export const runtime = "nodejs";
export const maxDuration = 60;

type Action =
  | "combine"
  | "feedback"
  | "overview"
  | "outline"
  | "study-guide"
  | "ideas";

const INSTR: Record<Action, string> = {
  combine: "Combine the selected notes into one unified note in Markdown. Preserve all key claims but remove duplication and contradictions.",
  feedback: "Provide constructive critical feedback on the prose/argument in the selected notes. Point out strengths, weaknesses, and concrete suggestions.",
  overview: "Write a concise Markdown overview of the selected notes (3-5 short paragraphs).",
  outline: "Convert the selected notes into a nested Markdown outline organised by theme.",
  "study-guide": "Turn the selected notes into a study guide in Markdown with Learning objectives, Key concepts, Open questions, and Glossary.",
  ideas: "Suggest 6-10 related ideas, follow-up questions, or research directions inspired by the selected notes AND the sources. Use bullet points.",
};

export async function POST(req: NextRequest) {
  try {
    const { notes, sources, action } = (await req.json()) as {
      notes: Note[];
      sources: Source[];
      action: Action;
    };
    if (!notes?.length) return NextResponse.json({ error: "no notes" }, { status: 400 });
    const grounding = buildSystemPrompt(sources, "default");
    const notesBlock = notes
      .map(
        (n, i) =>
          `--- Note ${i + 1}: ${n.title || "(untitled)"} ---\n${n.content}`,
      )
      .join("\n\n");
    const user = `${INSTR[action]}\n\nSELECTED NOTES:\n${notesBlock}`;
    const result = await pplxChat({
      model: "sonar-pro",
      messages: [
        { role: "system", content: grounding.systemPrompt },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      webSearch: false,
      maxTokens: 2500,
    });
    const content = result.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
