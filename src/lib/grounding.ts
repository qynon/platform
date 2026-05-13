import type { Source, Citation, ConversationalStyle } from "./types";

const MAX_CHARS_PER_SOURCE = 18000;
const MAX_TOTAL_CHARS = 60000;

export interface GroundingPayload {
  systemPrompt: string;
  sourceBlocks: Array<{ id: string; title: string; index: number; text: string }>;
}

export function buildSystemPrompt(
  sources: Source[],
  style: ConversationalStyle = "default",
): GroundingPayload {
  const enabled = sources.filter((s) => s.enabled && s.content.trim());
  if (enabled.length === 0) {
    return {
      systemPrompt:
        style === "learning-guide"
          ? "You are a Socratic learning guide. The user has not yet added any sources. Politely ask them to add sources first, in the same language they wrote in."
          : "You are a research assistant. The user has not added any sources yet. Politely ask them to add at least one source in the same language they wrote in.",
      sourceBlocks: [],
    };
  }

  const perSource = Math.min(
    MAX_CHARS_PER_SOURCE,
    Math.floor(MAX_TOTAL_CHARS / Math.max(1, enabled.length)),
  );
  const blocks = enabled.map((s, i) => ({
    id: s.id,
    title: s.title,
    index: i + 1,
    text: s.content.slice(0, perSource),
  }));

  const styleInstr =
    style === "learning-guide"
      ? `Adopt a Socratic, scaffolded teaching style. Break concepts into small steps, ask the learner short clarifying questions when useful, and progressively build understanding. Use simple analogies where helpful.`
      : `Be concise, well-structured, and direct. Use bullet lists, sub-headings, and short paragraphs.`;

  const corpus = blocks
    .map(
      (b) =>
        `<<<SOURCE ${b.index} id="${b.id}" title="${b.title.replace(/"/g, "'")}">>>\n${b.text}\n<<<END SOURCE ${b.index}>>>`,
    )
    .join("\n\n");

  const systemPrompt = `You are NotebookLM, an AI research assistant. You ONLY answer based on the provided SOURCES below. If the SOURCES do not contain the answer, say so honestly and suggest what additional source the user could add. Never fabricate information.

${styleInstr}

CITATION RULES:
- Whenever you reference information from a source, you MUST add an inline citation immediately after that statement in the form [N] where N is the SOURCE number from the corpus below.
- You can use multiple citations like [1][3].
- Citations point to the SOURCE blocks below by their number, NOT to web URLs.
- At the very end of your answer add a "Sources used:" line with the indexes of the sources you actually used, like: Sources used: 1, 3.
- Respond in the SAME LANGUAGE the user wrote their last question in. If they wrote Kazakh, reply in Kazakh.

SOURCES:
${corpus}`;

  return { systemPrompt, sourceBlocks: blocks };
}

/**
 * Extracts inline [N] citations from an assistant response and maps them to
 * source ids using the provided block index.
 */
export function extractCitations(
  text: string,
  blocks: GroundingPayload["sourceBlocks"],
  sources: Source[],
): Citation[] {
  const map: Record<number, string> = {};
  for (const b of blocks) map[b.index] = b.id;

  const found = new Map<number, Citation>();
  const re = /\[(\d{1,2})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    const sid = map[n];
    if (!sid || found.has(n)) continue;
    const src = sources.find((s) => s.id === sid);
    if (!src) continue;
    const snippet = src.content.slice(0, 240).replace(/\s+/g, " ").trim();
    found.set(n, { index: n, sourceId: sid, snippet, offset: 0 });
  }
  return Array.from(found.values()).sort((a, b) => a.index - b.index);
}
