/**
 * Server-side wrapper around the Perplexity Agent API.
 *
 * Docs: https://docs.perplexity.ai/docs/agent-api/quickstart
 *
 * The Agent API (a.k.a. the "Responses" API) is a multi-provider, tool-using
 * superset of `/chat/completions`. We hit `POST /v1/agent` directly so we
 * don't depend on the SDK.
 *
 * Key differences vs. our existing `pplxChat`:
 *   - `input` instead of `messages` (can be a string OR an array of content
 *     blocks with `input_text` / `input_image`).
 *   - `instructions` instead of a system message.
 *   - `tools[]` lets the model call built-in tools (web_search, fetch_url,
 *     finance_search, people_search) or custom function tools.
 *   - Returns an `output[]` array of typed events (messages, tool_calls,
 *     citations) PLUS a flat `output_text` for the final answer.
 *   - Returns granular `usage` including cost in USD.
 */

// The full list of multi-provider model strings is documented at
// https://docs.perplexity.ai/docs/agent-api/quickstart, but availability
// depends on the caller's tier. Models commented out below currently
// return 400 "model not supported" — re-enable when the tier exposes them.
export type AgentModel =
  | "openai/gpt-5.4"
  | "openai/gpt-5.1"
  // | "anthropic/claude-opus-4.1"
  // | "anthropic/claude-sonnet-4.5"
  // | "google/gemini-2.5-pro"
  // | "google/gemini-2.5-flash"
  // | "xai/grok-4"
  // | "perplexity/sonar-pro"
  // | "perplexity/sonar-reasoning"
  | "perplexity/sonar";

export type AgentPreset = "pro-search" | "deep-research";

export type AgentToolType =
  | "web_search"
  | "fetch_url"
  | "finance_search"
  | "people_search";

export interface AgentTool {
  type: AgentToolType;
  filters?: {
    search_domain_filter?: string[];
    search_recency_filter?: "hour" | "day" | "week" | "month" | "year";
    search_after_date?: string;
    search_before_date?: string;
    max_tokens_per_page?: number;
  };
}

export type AgentInputBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string | AgentInputBlock[];
}

export type AgentInput = string | AgentMessage[];

export interface AgentRequest {
  model?: AgentModel;
  preset?: AgentPreset;
  input: AgentInput;
  instructions?: string;
  tools?: AgentTool[];
  parallel_tool_calls?: boolean;
  temperature?: number;
  max_output_tokens?: number;
  /** Run as a long-running background task; result must be polled. */
  background?: boolean;
  /** Used to continue a previous response thread. */
  previous_response_id?: string;
}

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost?: {
    currency: "USD";
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
}

export interface AgentResponse {
  id: string;
  object: "response";
  status: "completed" | "in_progress" | "queued" | "incomplete" | "failed";
  model: string;
  /** Final flat text — convenient for direct rendering. */
  output_text: string;
  /** Structured events: messages, tool calls, citations. */
  output: Array<Record<string, unknown>>;
  usage?: AgentUsage;
  error?: { message: string } | null;
  created_at?: number;
  completed_at?: number;
}

const AGENT_BASE = "https://api.perplexity.ai/v1/agent";

function getKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    throw new Error(
      "PERPLEXITY_API_KEY is not configured. Add it to environment variables.",
    );
  }
  return key;
}

/**
 * Fire a request against the Agent API. Returns the response once the agent
 * finishes (synchronous mode) or after one poll round for background tasks.
 */
export async function callAgent(req: AgentRequest): Promise<AgentResponse> {
  const body: Record<string, unknown> = {
    input: req.input,
  };
  if (req.model) body.model = req.model;
  if (req.preset) body.preset = req.preset;
  if (req.instructions) body.instructions = req.instructions;
  if (req.tools && req.tools.length) body.tools = req.tools;
  if (req.parallel_tool_calls !== undefined)
    body.parallel_tool_calls = req.parallel_tool_calls;
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.max_output_tokens !== undefined)
    body.max_output_tokens = req.max_output_tokens;
  if (req.background) body.background = true;
  if (req.previous_response_id)
    body.previous_response_id = req.previous_response_id;

  const res = await fetch(AGENT_BASE, {
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
      `Perplexity Agent error ${res.status}: ${text.slice(0, 800)}`,
    );
  }
  return (await res.json()) as AgentResponse;
}

/**
 * Poll a background agent response until it terminates or `attempts` is hit.
 * Returns the most recent response. Each attempt waits `delayMs`.
 */
export async function pollAgent(
  id: string,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<AgentResponse> {
  const attempts = opts.attempts ?? 60;
  const delayMs = opts.delayMs ?? 2000;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${AGENT_BASE}/${id}`, {
      headers: { Authorization: `Bearer ${getKey()}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Perplexity Agent poll error ${res.status}: ${text.slice(0, 400)}`,
      );
    }
    const json = (await res.json()) as AgentResponse;
    if (json.status === "completed" || json.status === "failed" || json.status === "incomplete") {
      return json;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error("Agent task did not complete within polling budget");
}
