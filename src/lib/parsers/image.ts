import type { ParsedSource } from "./index";
import { clampContent } from "./index";

/**
 * For images, we rely on Perplexity's vision capability via a description
 * prompt at chat time. Here we attach the image as a base64 data URL so the
 * UI can show it; the "content" stores an extracted-description placeholder.
 */
export async function parseImage(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<ParsedSource> {
  // Try OCR with tesseract.js on the server.
  let ocrText = "";
  try {
    const tesseract = await import("tesseract.js");
    const result = await tesseract.recognize(buffer, "eng+rus", {
      logger: () => undefined,
    });
    ocrText = result.data.text || "";
  } catch (e) {
    ocrText = `(OCR unavailable: ${String(e).slice(0, 200)})`;
  }
  const body = ocrText.trim()
    ? `Image: ${filename}\nMIME: ${mime}\n\nOCR-extracted text:\n${ocrText.trim()}`
    : `Image: ${filename}\nMIME: ${mime}\n(No text could be extracted from the image via OCR.)`;
  return {
    kind: "image",
    title: filename,
    content: clampContent(body),
    mime,
    bytes: buffer.byteLength,
  };
}
