import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/research/route";

interface RequestRecord {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

const originalEnv = { ...process.env };
beforeEach(() => {
  delete process.env.PERPLEXITY_API_KEY;
  delete process.env.PARALLEL_API_KEY;
  delete process.env.RESEARCH_PROVIDER;
});
afterEach(() => {
  mock.restoreAll();
  for (const name of ["PERPLEXITY_API_KEY", "PARALLEL_API_KEY", "RESEARCH_PROVIDER"]) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

function request(mode: string = "discover", signal?: AbortSignal, query: unknown = "Kazakhstan renewable energy") {
  return new NextRequest("http://localhost/api/research", {
    method: "POST",
    body: JSON.stringify({ query, mode }),
    headers: { "Content-Type": "application/json" },
    signal,
  });
}

const source = { title: "Energy report", url: "https://example.org/report", excerpts: ["Primary source findings."] };

/** Keep the real route, provider resolver, MCP client and HTTP transport in use. */
function fixture(options: {
  payload?: unknown; textOnly?: boolean; error?: boolean; sse?: boolean;
  hangOnCall?: () => void;
} = {}) {
  const records: RequestRecord[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    records.push({ url, headers: new Headers(init?.headers), body });
    if (url === "https://api.perplexity.ai/chat/completions") {
      return Response.json({
        choices: [{ message: { content: JSON.stringify([{ title: "Saved provider", url: "https://example.org/saved", summary: "Kept" }]) } }],
        citations: ["https://example.org/saved"], search_results: [],
      });
    }
    assert.equal(url, "https://search.parallel.ai/mcp");
    if (init?.method === "GET") return new Response(null, { status: 405 });
    if (!("id" in body)) return new Response(null, { status: 202 });
    let result: unknown;
    switch (body.method) {
      case "initialize":
        result = { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } };
        break;
      case "tools/list":
        result = { tools: [{ name: "web_search", inputSchema: { type: "object" } }] };
        break;
      case "tools/call": {
        if (options.hangOnCall) {
          assert.ok(init?.signal);
          const signal = init.signal;
          signal.throwIfAborted();
          options.hangOnCall();
          return await new Promise<Response>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        }
        const payload = options.payload ?? { results: [source] };
        result = {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          ...(options.textOnly ? {} : { structuredContent: payload }),
          ...(options.error ? { isError: true } : {}),
        };
        break;
      }
      default: assert.fail(`Unexpected method: ${body.method}`);
    }
    const message = JSON.stringify({ jsonrpc: "2.0", id: body.id, result });
    return options.sse
      ? new Response(`event: message\ndata: ${message}\n\n`, { headers: { "Content-Type": "text/event-stream" } })
      : new Response(message, { headers: { "Content-Type": "application/json" } });
  });
  return records;
}

test("fresh no-key research returns sources for the notebook consumer through MCP", async () => {
  const records = fixture();
  const response = await POST(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  // DiscoverDialog uses j.sources, renders title/url/summary, and imports by URL.
  assert.deepEqual(data, { mode: "discover", sources: [{ title: source.title, url: source.url, summary: source.excerpts[0] }], raw: "" });
  for (const record of records) {
    assert.equal(record.url, "https://search.parallel.ai/mcp");
    assert.equal(record.headers.get("User-Agent"), "notebooklm-clone/0.1.0 (https://github.com/qynon/platform)");
    assert.equal(record.headers.has("Authorization"), false);
    assert.equal(record.headers.has("x-api-key"), false);
  }
  assert.ok(records.some((r) => r.body.method === "initialize"));
  assert.ok(records.some((r) => r.body.method === "tools/list"));
  const call = records.find((r) => r.body.method === "tools/call");
  assert.deepEqual(call?.body.params, {
    name: "web_search",
    arguments: { objective: "Find relevant, primary-quality web sources for a research notebook about: Kazakhstan renewable energy", search_queries: ["Kazakhstan renewable energy"] },
  });
});

test("fast mode supports SSE and text JSON tool responses", async () => {
  fixture({ sse: true, textOnly: true });
  const response = await POST(request("fast"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sources[0].summary, source.excerpts[0]);
});

test("saved Perplexity credential preserves the existing research provider", async () => {
  process.env.PERPLEXITY_API_KEY = "saved-test-key";
  const records = fixture();
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sources[0].title, "Saved provider");
  assert.equal(records.length, 1);
  assert.equal(records[0].url, "https://api.perplexity.ai/chat/completions");
  assert.equal(records[0].headers.get("Authorization"), "Bearer saved-test-key");
  assert.equal(records[0].body.model, "sonar-pro");
});

test("explicit Parallel overrides a configured key without forwarding credentials", async () => {
  process.env.PERPLEXITY_API_KEY = "saved-test-key";
  process.env.PARALLEL_API_KEY = "ambient-test-key";
  process.env.RESEARCH_PROVIDER = "parallel";
  const records = fixture();
  assert.equal((await POST(request("fast"))).status, 200);
  assert.ok(records.every((r) => r.url === "https://search.parallel.ai/mcp" && !r.headers.has("Authorization")));
});

test("explicit Perplexity never falls back when its key is absent", async () => {
  process.env.RESEARCH_PROVIDER = "perplexity";
  const records = fixture();
  const response = await POST(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /PERPLEXITY_API_KEY/);
  assert.equal(records.length, 0);
});

test("disabled research forbids every mode before any network access", async () => {
  process.env.RESEARCH_PROVIDER = "disabled";
  process.env.PERPLEXITY_API_KEY = "saved-test-key";
  const records = fixture();
  for (const mode of ["discover", "fast", "deep"]) assert.equal((await POST(request(mode))).status, 403);
  assert.equal(records.length, 0);
});

test("invalid provider configuration fails without choosing another provider", async () => {
  process.env.RESEARCH_PROVIDER = "typo";
  const records = fixture();
  assert.equal((await POST(request())).status, 500);
  assert.equal(records.length, 0);
});

test("deep synthesis retains Perplexity even when Parallel source search is selected", async () => {
  process.env.RESEARCH_PROVIDER = "parallel";
  process.env.PERPLEXITY_API_KEY = "saved-test-key";
  const records = fixture();
  const response = await POST(request("deep"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, "deep");
  assert.equal(records.length, 1);
  assert.equal(records[0].body.model, "sonar-deep-research");
});

test("tool errors do not return successful empty sources or trigger fallback", async () => {
  const records = fixture({ error: true });
  const response = await POST(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /temporarily unavailable/);
  assert.ok(records.every((r) => r.url === "https://search.parallel.ai/mcp"));
});

test("malformed tool payload fails instead of silently hiding a protocol problem", async () => {
  fixture({ payload: { unexpected: [] } });
  const response = await POST(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /invalid search response/);
});

test("result consumption filters unsafe URLs, deduplicates, and bounds display text", async () => {
  fixture({ payload: { results: [
    { ...source, url: "javascript:alert(1)" }, { ...source, url: "https://user:pass@example.org/" },
    { ...source, url: "invalid" }, source, source,
    ...Array.from({ length: 20 }, (_, i) => ({ title: "x".repeat(300), url: `https://example.org/${i}`, excerpts: ["y".repeat(700)] })),
  ] } });
  const response = await POST(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.sources.length, 10);
  assert.equal(data.sources[0].url, source.url);
  assert.equal(data.sources[1].title.length, 200);
  assert.equal(data.sources[1].summary.length, 500);
});

test("invalid input is rejected before making search requests", async () => {
  const records = fixture();
  for (const query of ["", "   ", 7, null, "x".repeat(4001)]) {
    assert.equal((await POST(request("discover", undefined, query))).status, 400);
  }
  assert.equal((await POST(request("unknown"))).status, 400);
  assert.equal(records.length, 0);
});

function hangingFetch(onRequest: () => void) {
  mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    const signal = init?.signal;
    assert.ok(signal);
    signal.throwIfAborted();
    onRequest();
    return await new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
}

test("cancellation aborts in-flight MCP initialization and returns no results", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  hangingFetch(started);
  const response = POST(request("discover", controller.signal));
  await ready;
  controller.abort();
  assert.equal((await response).status, 499);
});

test("the overall deadline also bounds MCP initialization", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    assert.equal(milliseconds, 30_000);
    return timeout(20);
  });
  hangingFetch(() => undefined);
  // AbortSignal.timeout uses an unref timer; keep this isolated test alive.
  const keepAlive = setTimeout(() => undefined, 1000);
  try {
    const response = await POST(request());
    assert.equal(response.status, 504);
  } finally { clearTimeout(keepAlive); }
});

test("cancellation reaches an in-flight search tool call after discovery", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const records = fixture({ hangOnCall: started });
  const response = POST(request("discover", controller.signal));
  await ready;
  controller.abort();
  assert.equal((await response).status, 499);
  assert.ok(records.some((r) => r.body.method === "tools/call"));
});

test("the deadline aborts an in-flight search tool call", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  mock.method(AbortSignal, "timeout", () => timeout(50));
  const records = fixture({ hangOnCall: () => undefined });
  const keepAlive = setTimeout(() => undefined, 1000);
  try {
    assert.equal((await POST(request())).status, 504);
    assert.ok(records.some((r) => r.body.method === "tools/call"));
  } finally { clearTimeout(keepAlive); }
});

test("a configured Perplexity failure is surfaced without anonymous fallback", async () => {
  process.env.PERPLEXITY_API_KEY = "saved-test-key";
  let calls = 0;
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    calls++;
    assert.equal(input.toString(), "https://api.perplexity.ai/chat/completions");
    return new Response("Unavailable", { status: 503 });
  });
  assert.equal((await POST(request())).status, 500);
  assert.equal(calls, 1);
});

test("HTTP transport failures surface without falling back to paid search", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    calls++;
    assert.equal(input.toString(), "https://search.parallel.ai/mcp");
    return new Response("Service unavailable", { status: 503 });
  });
  const response = await POST(request());
  assert.equal(response.status, 500);
  assert.equal(calls, 1);
});
