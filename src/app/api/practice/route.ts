import { NextRequest, NextResponse } from "next/server";
import { pplxChat } from "@/lib/perplexity";
import type { Source, AssignmentSpec } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type PracticeMode = "solve" | "grade" | "hint";

interface PracticeBody {
  mode: PracticeMode;
  /** The "assignment" source the student is working on. */
  assignmentSource: Source;
  /** For grade mode: the student's submitted answer. */
  studentAnswer?: string;
  /** Override of stored rubric / difficulty. */
  spec?: AssignmentSpec;
}

const SOLVE_INSTRUCTIONS = `You are a patient tutor. Produce a complete, step-by-step solution to the assignment below.

REQUIREMENTS:
- Number every step (1., 2., 3., ...).
- Show all relevant working, including intermediate calculations.
- Use Markdown for structure.
- Use LaTeX for math:
  - Inline: $...$  (e.g. $x^2 + 1$)
  - Block:  $$...$$
- End with a clearly-labelled **Final answer** section.
- Reply in the same language the assignment is written in.`;

const GRADE_INSTRUCTIONS = `You are a fair, encouraging grader.

REQUIREMENTS:
- Grade the student's answer against the reference solution and rubric.
- Output Markdown with these sections (in this exact order):
  ## Бағалау (Score)
  (a percentage 0-100 plus a one-sentence verdict)
  ## Дұрыс (Correct)
  (bullet list of what the student got right)
  ## Қателер (Mistakes)
  (bullet list of specific errors, citing where in the student's work they occurred)
  ## Кеңестер (Hints)
  (1-3 concrete next-step suggestions, *not* the full answer)
- Use LaTeX (\\$...\\$) for any math.
- Reply in the same language the assignment / student answer was written in.
- Be specific. Do NOT invent details that aren't in the student's submission.`;

const HINT_INSTRUCTIONS = `You are a tutor giving ONE hint without revealing the full answer.

REQUIREMENTS:
- Produce a single short paragraph (2-3 sentences).
- The hint should nudge the student toward the next correct step, NOT solve it.
- Use LaTeX for math if needed.
- Reply in the same language as the assignment.`;

function buildSystemPrompt(spec?: AssignmentSpec): string {
  const parts = ["You are an expert tutor."];
  if (spec?.subject) parts.push(`Subject area: ${spec.subject}.`);
  if (spec?.difficulty) parts.push(`Expected difficulty: ${spec.difficulty}.`);
  if (spec?.rubric) parts.push(`Rubric:\n${spec.rubric}`);
  parts.push(
    "Always render math using LaTeX delimiters (inline $...$ or block $$...$$). Stay strictly grounded in the assignment / rubric. Do NOT search the web.",
  );
  return parts.join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PracticeBody;
    const src = body.assignmentSource;
    if (!src || !src.content?.trim()) {
      return NextResponse.json(
        { error: "Assignment source is empty." },
        { status: 400 },
      );
    }
    const spec = body.spec ?? src.assignment;
    const system = buildSystemPrompt(spec);

    let instruction = SOLVE_INSTRUCTIONS;
    let userPrompt = `Assignment:\n${src.content}\n\nSolve it fully.`;
    if (body.mode === "grade") {
      instruction = GRADE_INSTRUCTIONS;
      const reference = spec?.solution
        ? `\n\nReference solution:\n${spec.solution}`
        : "";
      userPrompt = `Assignment:\n${src.content}${reference}\n\nStudent's answer:\n${body.studentAnswer ?? ""}`;
    } else if (body.mode === "hint") {
      instruction = HINT_INSTRUCTIONS;
      userPrompt = `Assignment:\n${src.content}\n\nThe student is stuck. Give ONE hint.`;
    }

    const result = await pplxChat({
      model: "sonar-pro",
      messages: [
        { role: "system", content: `${system}\n\n${instruction}` },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      webSearch: false,
      maxTokens: 3000,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ content: text, mode: body.mode });
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
