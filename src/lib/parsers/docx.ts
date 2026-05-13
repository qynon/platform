import type { ParsedSource } from "./index";
import { clampContent } from "./index";

export async function parseDocx(
  buffer: Buffer,
  filename: string,
): Promise<ParsedSource> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return {
    kind: "docx",
    title: filename,
    content: clampContent(result.value),
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: buffer.byteLength,
  };
}
