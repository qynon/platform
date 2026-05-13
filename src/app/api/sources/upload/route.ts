import { NextRequest, NextResponse } from "next/server";
import {
  parseCsv,
  parseDocx,
  parseImage,
  parseMarkdown,
  parsePdf,
  parsePptx,
  parseText,
} from "@/lib/parsers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name || "untitled";
    const lower = filename.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";

    if (lower.endsWith(".pdf") || mime === "application/pdf") {
      return NextResponse.json(await parsePdf(buf, filename));
    }
    if (lower.endsWith(".docx")) {
      return NextResponse.json(await parseDocx(buf, filename));
    }
    if (lower.endsWith(".pptx")) {
      return NextResponse.json(await parsePptx(buf, filename));
    }
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
      return NextResponse.json(parseMarkdown(buf.toString("utf8"), filename));
    }
    if (lower.endsWith(".csv")) {
      return NextResponse.json(parseCsv(buf.toString("utf8"), filename));
    }
    if (lower.endsWith(".txt") || mime.startsWith("text/plain")) {
      return NextResponse.json(parseText(buf.toString("utf8"), filename));
    }
    if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif|ico|jp2)$/i.test(lower)) {
      const parsed = await parseImage(buf, filename, mime);
      return NextResponse.json(parsed);
    }
    // Fallback: try to parse as text
    return NextResponse.json(parseText(buf.toString("utf8"), filename));
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
