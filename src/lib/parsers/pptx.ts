import JSZip from "jszip";
import type { ParsedSource } from "./index";
import { clampContent } from "./index";

/**
 * Naive PPTX text extractor: unzips the file and reads every slide XML,
 * stripping XML tags to leave the raw text.
 */
export async function parsePptx(
  buffer: Buffer,
  filename: string,
): Promise<ParsedSource> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files).filter(
    (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n),
  );
  slideEntries.sort((a, b) => {
    const na = Number(a.match(/slide(\d+)/)?.[1] ?? "0");
    const nb = Number(b.match(/slide(\d+)/)?.[1] ?? "0");
    return na - nb;
  });

  const slides: string[] = [];
  for (let i = 0; i < slideEntries.length; i++) {
    const xml = await zip.files[slideEntries[i]].async("string");
    const text = stripXml(xml);
    slides.push(`--- Slide ${i + 1} ---\n${text}`);
  }
  const content = clampContent(slides.join("\n\n"));
  return {
    kind: "pptx",
    title: filename,
    content: content || "(No text extracted from PPTX)",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    bytes: buffer.byteLength,
  };
}

function stripXml(xml: string): string {
  // Pull out <a:t>...</a:t> runs (PPTX text runs) and join.
  const parts: string[] = [];
  const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) parts.push(m[1]);
  return parts
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
