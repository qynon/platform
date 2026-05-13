import * as cheerio from "cheerio";
import type { ParsedSource } from "./index";
import { clampContent } from "./index";

export async function parseUrl(url: string): Promise<ParsedSource> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; NotebookLM-Clone/1.0; +https://notebooklm.dev)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, nav, footer, header, form").remove();

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    url;

  // Try to find the main article-like region; fall back to body.
  let mainText = "";
  const candidates = ["article", "main", "[role='main']", "#content", ".content", "body"];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      mainText = el.text();
      if (mainText.replace(/\s+/g, " ").trim().length > 400) break;
    }
  }
  if (!mainText) mainText = $("body").text();

  const cleaned = mainText
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    kind: "url",
    title: title.trim().slice(0, 200) || url,
    content: clampContent(cleaned || "(No readable text on this page)"),
    url,
    mime: "text/html",
  };
}
