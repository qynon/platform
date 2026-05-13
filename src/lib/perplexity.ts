/**
 * Server-side wrapper around the Perplexity API.
 *
 * Docs: https://docs.perplexity.ai
 *
 * Models we use:
 *   - sonar              : default fast chat / grounded answers
 *   - sonar-pro          : higher quality answers
 *   - sonar-reasoning    : long-form reasoning
 *   - sonar-deep-research: multi-step research agent (Deep Research)
 */

export type PerplexityModel =
  | "sonar"
  | "sonar-pro"
  | "sonar-reasoning"
  | "sonar-reasoning-pro"
  | "sonar-deep-research";

export interface PplxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PplxCompletionChoice {
  message: { role: string; content: string };
  finish_reason?: string;
}

interface PplxCompletion {
  id: string;
  model: string;
  choices: PplxCompletionChoice[];
  citations?: string[];
  search_results?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
    date?: string;
  }>;
}

const API_BASE = "https://api.perplexity.ai";

function getKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error(
      "PERPLEXITY_API_KEY is not configured. Add it to environment variables.",
    );
  }
  return key;
}

export async function pplxChat(opts: {
  model?: PerplexityModel;
  messages: PplxMessage[];
  temperature?: number;
  searchMode?: "web" | "academic";
  reasoningEffort?: "low" | "medium" | "high";
  maxTokens?: number;
  webSearch?: boolean;
}): Promise<PplxCompletion> {
  const model = opts.model ?? "sonar";
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
  };
  if (opts.searchMode) body.search_mode = opts.searchMode;
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.webSearch === false) {
    body.search_mode = "off";
  }

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Perplexity error ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  return (await res.json()) as PplxCompletion;
}

/**
 * Single-shot helper that returns just the text content.
 */
export async function pplxComplete(
  prompt: string,
  opts: Partial<Parameters<typeof pplxChat>[0]> = {},
): Promise<{ content: string; citations: string[]; results: PplxCompletion["search_results"] }> {
  const res = await pplxChat({
    ...opts,
    messages: opts.messages ?? [{ role: "user", content: prompt }],
  });
  const content = res.choices?.[0]?.message?.content ?? "";
  return {
    content,
    citations: res.citations ?? [],
    results: res.search_results ?? [],
  };
}
