import type { SourceKind } from "../types";

export interface ParsedSource {
  kind: SourceKind;
  title: string;
  content: string;
  mime?: string;
  bytes?: number;
  url?: string;
  /** Optional data URI for image sources, used by vision-enabled models. */
  imageDataUri?: string;
}

const MAX_CONTENT = 500_000;

export function clampContent(c: string): string {
  return c.length > MAX_CONTENT ? c.slice(0, MAX_CONTENT) : c;
}

export { parsePdf } from "./pdf";
export { parseDocx } from "./docx";
export { parsePptx } from "./pptx";
export { parseUrl } from "./url";
export { parseYoutube } from "./youtube";
export { parseImage } from "./image";
export { parseText, parseCsv, parseMarkdown } from "./text";
