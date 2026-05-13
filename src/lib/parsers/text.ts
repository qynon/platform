import type { ParsedSource } from "./index";
import { clampContent } from "./index";

export function parseText(content: string, filename: string): ParsedSource {
  return {
    kind: "text",
    title: filename || "Көшірілген мәтін",
    content: clampContent(content),
    mime: "text/plain",
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

export function parseMarkdown(content: string, filename: string): ParsedSource {
  return {
    kind: "markdown",
    title: filename,
    content: clampContent(content),
    mime: "text/markdown",
    bytes: Buffer.byteLength(content, "utf8"),
  };
}

export function parseCsv(content: string, filename: string): ParsedSource {
  return {
    kind: "csv",
    title: filename,
    content: clampContent(content),
    mime: "text/csv",
    bytes: Buffer.byteLength(content, "utf8"),
  };
}
