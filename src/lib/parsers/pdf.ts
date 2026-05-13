import type { ParsedSource } from "./index";
import { clampContent } from "./index";

/**
 * Parse a PDF buffer into plain text using pdfjs-dist.
 * Runs on the Node server (API routes), not in the browser.
 */
export async function parsePdf(
  buffer: ArrayBuffer | Buffer,
  filename: string,
): Promise<ParsedSource> {
  const data =
    buffer instanceof Buffer
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer as ArrayBuffer);

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable worker in node
  (pdfjsLib.GlobalWorkerOptions as { workerSrc: string }).workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    const pageText = text.items
      .map((it: unknown) => {
        const item = it as { str?: string };
        return item.str ?? "";
      })
      .join(" ");
    parts.push(pageText);
  }
  const content = clampContent(parts.join("\n\n").trim() || "(PDF contains no extractable text)");
  return {
    kind: "pdf",
    title: filename,
    content,
    mime: "application/pdf",
    bytes: data.byteLength,
  };
}
