import type { ParsedSource } from "./index";
import { clampContent } from "./index";

/**
 * Parses a YouTube URL into a transcript-backed source.
 * Uses the youtube-transcript package which scrapes the timedtext endpoint.
 */
export async function parseYoutube(url: string): Promise<ParsedSource> {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const { YoutubeTranscript } = await import("youtube-transcript");
  let transcript: Array<{ text: string; offset: number; duration: number }>;
  try {
    transcript = (await YoutubeTranscript.fetchTranscript(videoId)) as Array<{
      text: string;
      offset: number;
      duration: number;
    }>;
  } catch (e) {
    throw new Error(
      `Could not fetch YouTube transcript. The video may not have captions, may be private, or was uploaded within the last 72 hours. (${String(e)})`,
    );
  }
  if (!transcript || transcript.length === 0) {
    throw new Error("No transcript available for this video.");
  }
  const text = transcript
    .map((t) => decodeHtml(t.text))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  let title = `YouTube ${videoId}`;
  try {
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
    if (oembed.ok) {
      const j = (await oembed.json()) as { title?: string };
      if (j.title) title = j.title;
    }
  } catch {
    /* ignore */
  }

  return {
    kind: "youtube",
    title,
    content: clampContent(text),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    mime: "text/youtube-transcript",
  };
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      const i = parts.indexOf("shorts");
      if (i !== -1 && parts[i + 1]) return parts[i + 1];
      const e = parts.indexOf("embed");
      if (e !== -1 && parts[e + 1]) return parts[e + 1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
