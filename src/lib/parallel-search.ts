import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

export interface ResearchSource {
  title: string;
  url: string;
  summary: string;
}

const ENDPOINT = "https://search.parallel.ai/mcp";
const USER_AGENT = "notebooklm-clone/0.1.0 (https://github.com/qynon/platform)";
const TIMEOUT_MS = 30_000;

/** Source discovery only: report synthesis and URL import keep their own paths. */
export async function parallelSearch(
  query: string,
  requestSignal: AbortSignal,
): Promise<ResearchSource[]> {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(TIMEOUT_MS)]);
  signal.throwIfAborted();
  const client = new Client({ name: "notebooklm-clone", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), {
    requestInit: { headers: { "User-Agent": USER_AGENT } },
    // Cover initialization and HTTP streams as well as the tool request.
    fetch: (url, init) => fetch(url, {
      ...init,
      signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
    }),
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools({}, { signal });
    if (!tools.some((tool) => tool.name === "web_search")) {
      throw new Error("Parallel Search MCP does not provide web_search.");
    }
    const result = CallToolResultSchema.parse(await client.callTool({
      name: "web_search",
      arguments: {
        objective: `Find relevant, primary-quality web sources for a research notebook about: ${query}`,
        search_queries: [query],
      },
    }, CallToolResultSchema, { signal }));
    if (result.isError) {
      throw new Error("Parallel search is temporarily unavailable. Please try again later.");
    }

    let data: unknown = result.structuredContent;
    if (!data) {
      const text = result.content.find((item) => item.type === "text");
      if (text?.type === "text") data = JSON.parse(text.text);
    }
    if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
      throw new Error("Parallel returned an invalid search response.");
    }

    const sources: ResearchSource[] = [];
    const seen = new Set<string>();
    for (const row of data.results) {
      if (!row || typeof row !== "object" || typeof row.url !== "string") continue;
      let url: URL;
      try { url = new URL(row.url); } catch { continue; }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      sources.push({
        title: (typeof row.title === "string" && row.title ? row.title : url.href).slice(0, 200),
        url: url.href,
        summary: Array.isArray(row.excerpts)
          ? row.excerpts.filter((value: unknown) => typeof value === "string").join("\n").slice(0, 500)
          : "",
      });
      if (sources.length === 10) break;
    }
    return sources;
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  } finally {
    await client.close();
  }
}
