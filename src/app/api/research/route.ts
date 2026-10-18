import { NextRequest, NextResponse } from "next/server";
import { pplxChat } from "@/lib/perplexity";
import { parallelSearch } from "@/lib/parallel-search";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ResearchBody {
  query: string;
  mode: "fast" | "deep" | "discover";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResearchBody | null;
    if (!body || typeof body.query !== "string" || !body.query.trim() || body.query.length > 4000) {
      return NextResponse.json({ error: "query must contain 1-4000 characters" }, { status: 400 });
    }
    const query = body.query.trim();
    const mode = body.mode;
    if (!["discover", "fast", "deep"].includes(mode)) {
      return NextResponse.json({ error: "invalid research mode" }, { status: 400 });
    }
    const provider = process.env.RESEARCH_PROVIDER;
    if (provider === "disabled") {
      return NextResponse.json({ error: "Research is disabled" }, { status: 403 });
    }
    if (provider && provider !== "parallel" && provider !== "perplexity") {
      throw new Error("RESEARCH_PROVIDER must be parallel, perplexity or disabled.");
    }
    req.signal.throwIfAborted();

    if (mode === "discover" || mode === "fast") {
      // An intentionally configured Perplexity key keeps the existing behavior.
      const useParallel = provider === "parallel" || (!provider && !process.env.PERPLEXITY_API_KEY);
      if (useParallel) {
        const sources = await parallelSearch(query, req.signal);
        return NextResponse.json({ mode, sources, raw: "" });
      }
      const prompt = `You are helping a researcher build a notebook. The user wants to investigate: "${query}".

Find up to 10 highly relevant, primary-quality web sources. For EACH source return:
- A short title
- The URL
- A 1-2 sentence summary explaining why this source is relevant

Return ONLY a JSON array, like:
[
  {"title": "...", "url": "https://...", "summary": "..."}
]
No prose around the JSON.`;
      const result = await pplxChat({
        model: mode === "fast" ? "sonar" : "sonar-pro",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        webSearch: true,
        maxTokens: 1800,
      });
      const text = result.choices?.[0]?.message?.content ?? "";
      const sources = parseJsonArray(text, result.search_results);
      return NextResponse.json({ mode, sources, raw: text });
    }

    // deep
    const result = await pplxChat({
      model: "sonar-deep-research",
      messages: [
        {
          role: "system",
          content:
            "You are an expert research analyst. Produce a thorough, source-grounded report.",
        },
        { role: "user", content: query },
      ],
      reasoningEffort: "high",
      maxTokens: 4000,
      webSearch: true,
    });
    const text = result.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({
      mode: "deep",
      report: text,
      webCitations: result.citations ?? [],
      searchResults: result.search_results ?? [],
    });
  } catch (e) {
    const status = req.signal.aborted ? 499
      : e instanceof Error && e.name === "TimeoutError" ? 504 : 500;
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status },
    );
  }
}

function parseJsonArray(
  text: string,
  fallback?: Array<{ title?: string; url?: string; snippet?: string }>,
): Array<{ title: string; url: string; summary: string }> {
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      const slice = text.slice(start, end + 1);
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((x) => x && typeof x.url === "string")
          .map((x) => ({
            title: String(x.title || x.url).slice(0, 200),
            url: String(x.url),
            summary: String(x.summary || "").slice(0, 500),
          }));
      }
    }
  } catch {
    /* fall through */
  }
  if (fallback) {
    return fallback
      .filter((x) => x.url)
      .map((x) => ({
        title: String(x.title || x.url).slice(0, 200),
        url: String(x.url),
        summary: String(x.snippet || "").slice(0, 500),
      }));
  }
  return [];
}
