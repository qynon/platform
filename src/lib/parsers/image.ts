import type { ParsedSource } from "./index";
import { clampContent } from "./index";

/**
 * For images we do two things:
 *   1. Run server-side OCR (tesseract.js) so the text grounds *text* chat.
 *   2. Encode the image as a base64 data URI so the chat route can attach
 *      it to a multimodal request and the model can actually SEE it.
 */
export async function parseImage(
  buffer: Buffer,
  filename: string,
  mime: string,
): Promise<ParsedSource & { imageDataUri?: string }> {
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
    : `Image: ${filename}\nMIME: ${mime}\n(No text could be extracted from the image via OCR. The model will analyze it visually.)`;

  // Only include the base64 payload for formats the Perplexity vision API
  // actually accepts. Otherwise we skip it (still keep the OCR text).
  const accepted = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  let imageDataUri: string | undefined;
  if (accepted.includes(mime) && buffer.byteLength < 50 * 1024 * 1024) {
    imageDataUri = `data:${mime};base64,${buffer.toString("base64")}`;
  }

  return {
    kind: "image",
    title: filename,
    content: clampContent(body),
    mime,
    bytes: buffer.byteLength,
    imageDataUri,
  };
}
