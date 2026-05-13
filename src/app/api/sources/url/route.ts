import { NextRequest, NextResponse } from "next/server";
import { parseUrl, parseYoutube } from "@/lib/parsers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      return NextResponse.json(await parseYoutube(url));
    }
    return NextResponse.json(await parseUrl(url));
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 500 },
    );
  }
}
