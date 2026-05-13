"use client";
import { useMemo, useState } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
}

interface Deck {
  title: string;
  slides: Slide[];
}

function parseDeck(raw: string): Deck | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.slides)) return null;
    return {
      title: String(obj.title || "Презентация"),
      slides: obj.slides.map((s: unknown) => {
        const sl = s as { title?: string; bullets?: string[]; notes?: string };
        return {
          title: String(sl.title || ""),
          bullets: Array.isArray(sl.bullets) ? sl.bullets.map((b) => String(b)) : [],
          notes: sl.notes ? String(sl.notes) : undefined,
        };
      }),
    };
  } catch {
    return null;
  }
}

export function SlidesView({ artifact }: { artifact: StudioArtifact }) {
  const deck = useMemo(() => parseDeck(artifact.body), [artifact.body]);
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  if (!deck) {
    return (
      <div className="p-6 text-sm">
        Презентацияны талдау мүмкін болмады.
        <pre className="mt-3 text-xs whitespace-pre-wrap">{artifact.body}</pre>
      </div>
    );
  }

  async function downloadPptx() {
    if (!deck) return;
    const pptxgen = (await import("pptxgenjs")).default;
    const pres = new pptxgen();
    pres.title = deck.title;
    const title = pres.addSlide();
    title.addText(deck.title, {
      x: 0.5,
      y: 2,
      w: 9,
      fontSize: 36,
      bold: true,
      color: "1F2937",
    });
    for (const s of deck.slides) {
      const slide = pres.addSlide();
      slide.addText(s.title, { x: 0.5, y: 0.3, w: 9, fontSize: 28, bold: true, color: "1F2937" });
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.6, y: 1.2, w: 8.5, h: 4.5, fontSize: 16, color: "374151" },
      );
      if (s.notes) slide.addNotes(s.notes);
    }
    await pres.writeFile({ fileName: `${deck.title}.pptx` });
  }

  function downloadJson() {
    if (!deck) return;
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!deck) return;
    setGeneratingPdf(true);
    try {
      const pptxgen = (await import("pptxgenjs")).default;
      const pres = new pptxgen();
      pres.title = deck.title;
      for (const s of deck.slides) {
        const slide = pres.addSlide();
        slide.addText(s.title, { x: 0.5, y: 0.3, w: 9, fontSize: 28, bold: true });
        slide.addText(
          s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
          { x: 0.6, y: 1.2, w: 8.5, h: 4.5, fontSize: 16 },
        );
      }
      await pres.writeFile({ fileName: `${deck.title}.pptx` });
    } finally {
      setGeneratingPdf(false);
    }
  }

  const cur = deck.slides[idx];

  const SlideCard = (
    <div className="rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-50 p-10 aspect-video flex flex-col">
      <h3 className="text-3xl font-bold mb-4 text-zinc-900">{cur.title}</h3>
      <ul className="text-lg space-y-2 text-zinc-800 flex-1">
        {cur.bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-blue-600">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {cur.notes && (
        <div className="mt-4 text-xs text-zinc-600 italic line-clamp-2">{cur.notes}</div>
      )}
      <div className="mt-2 text-right text-xs text-zinc-500">
        {idx + 1} / {deck.slides.length}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-black flex flex-col"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setIdx(Math.min(deck.slides.length - 1, idx + 1));
          if (e.key === "ArrowLeft") setIdx(Math.max(0, idx - 1));
          if (e.key === "Escape") setFullscreen(false);
        }}
        tabIndex={0}
      >
        <div className="flex-1 flex items-center justify-center p-12">{SlideCard}</div>
        <div className="text-center pb-4 text-white text-sm">
          <button onClick={() => setFullscreen(false)} className="btn text-xs">
            <I.X className="w-3.5 h-3.5" /> {t.common.close}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{deck.title}</h2>
        <div className="flex gap-2">
          <button onClick={downloadPptx} className="btn text-xs">
            <I.Download className="w-3.5 h-3.5" /> .pptx
          </button>
          <button onClick={downloadPdf} className="btn text-xs" disabled={generatingPdf}>
            <I.Download className="w-3.5 h-3.5" /> {generatingPdf ? "..." : "PDF"}
          </button>
          <button onClick={downloadJson} className="btn text-xs">
            <I.Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button onClick={() => setFullscreen(true)} className="btn text-xs">
            <I.Maximize2 className="w-3.5 h-3.5" /> {t.studio.fullscreen}
          </button>
        </div>
      </div>
      {SlideCard}
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="btn text-xs">
          <I.ChevronLeft className="w-3.5 h-3.5" /> {t.studio.previous}
        </button>
        <div className="flex flex-wrap gap-1 max-w-[60%]">
          {deck.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-6 h-6 rounded text-[10px] cursor-pointer ${
                i === idx ? "bg-zinc-900 text-white" : "bg-zinc-100 hover:bg-zinc-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIdx(Math.min(deck.slides.length - 1, idx + 1))}
          disabled={idx === deck.slides.length - 1}
          className="btn text-xs"
        >
          {t.studio.next} <I.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
