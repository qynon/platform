"use client";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

interface Card {
  front: string;
  back: string;
  explain?: string;
}

function tryParse(raw: string): Card[] {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
      .map((c) => ({
        front: String(c.front),
        back: String(c.back),
        explain: c.explain ? String(c.explain) : undefined,
      }));
  } catch {
    return [];
  }
}

export function FlashcardsView({ artifact }: { artifact: StudioArtifact }) {
  const cards = useMemo(() => tryParse(artifact.body), [artifact.body]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [explain, setExplain] = useState(false);
  const [got, setGot] = useState<Set<number>>(new Set());
  const [missed, setMissed] = useState<Set<number>>(new Set());
  const [pool, setPool] = useState<number[]>(cards.map((_, i) => i));
  const [done, setDone] = useState(false);
  const [shuffled, setShuffled] = useState(false);

  const cur = cards[pool[idx]];

  function next() {
    setExplain(false);
    setFlipped(false);
    if (idx >= pool.length - 1) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }
  function prev() {
    setExplain(false);
    setFlipped(false);
    if (idx > 0) setIdx(idx - 1);
  }
  function restart(filter?: "missed" | "all") {
    let next = cards.map((_, i) => i);
    if (filter === "missed") next = Array.from(missed);
    if (shuffled) next = [...next].sort(() => Math.random() - 0.5);
    setPool(next);
    setIdx(0);
    setGot(new Set());
    setMissed(new Set());
    setDone(false);
    setFlipped(false);
    setExplain(false);
  }
  function shuffle() {
    setPool([...pool].sort(() => Math.random() - 0.5));
    setShuffled(true);
    setIdx(0);
    setFlipped(false);
  }
  function downloadCsv() {
    const csv = Papa.unparse(cards.map((c) => ({ Front: c.front, Back: c.back, Explanation: c.explain || "" })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cards.length === 0) {
    return (
      <div className="p-6">
        <div className="text-sm text-zinc-600">Карталарды талдау мүмкін болмады.</div>
        <pre className="mt-3 text-xs whitespace-pre-wrap">{artifact.body}</pre>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-xl font-semibold">Бітті</h3>
        <p className="text-sm text-zinc-600">
          {t.studio.progress(got.size, cards.length)} білдіңіз, {missed.size}-сін білмедіңіз.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button className="btn" onClick={() => restart("all")}>
            <I.RotateCcw className="w-4 h-4" /> {t.studio.practiceAll}
          </button>
          <button className="btn" onClick={() => restart("missed")} disabled={missed.size === 0}>
            <I.RotateCcw className="w-4 h-4" /> {t.studio.practiceMissed}
          </button>
          <button className="btn" onClick={() => restart()}>
            {t.studio.practiceAgain}
          </button>
          <button className="btn" onClick={downloadCsv}>
            <I.Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
        <span>{t.studio.progress(idx + 1, pool.length)}</span>
        <div className="flex gap-2">
          <button className="btn text-xs" onClick={shuffle}>
            <I.Shuffle className="w-3.5 h-3.5" /> {t.studio.shuffle}
          </button>
          <button className="btn text-xs" onClick={() => restart()}>
            <I.RotateCcw className="w-3.5 h-3.5" /> {t.studio.restart}
          </button>
          <button className="btn text-xs" onClick={downloadCsv}>
            <I.Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>
      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer select-none rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-50 to-pink-50 min-h-[300px] flex items-center justify-center p-8 text-center"
      >
        <div>
          <div className="text-xs uppercase text-zinc-500 mb-3">
            {flipped ? "Жауап" : "Сұрақ"}
          </div>
          <div className="text-lg font-semibold whitespace-pre-wrap">
            {flipped ? cur.back : cur.front}
          </div>
          {flipped && explain && cur.explain && (
            <div className="mt-4 text-sm text-zinc-700 italic">{cur.explain}</div>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={prev} className="btn text-xs" disabled={idx === 0}>
          <I.ChevronLeft className="w-3.5 h-3.5" /> {t.studio.previous}
        </button>
        <div className="flex gap-2">
          {flipped && cur.explain && (
            <button onClick={() => setExplain(!explain)} className="btn text-xs">
              <I.Lightbulb className="w-3.5 h-3.5" /> {t.studio.explain}
            </button>
          )}
          <button
            onClick={() => {
              const n = new Set(got);
              n.add(pool[idx]);
              setGot(n);
              next();
            }}
            className="btn text-xs text-emerald-700"
          >
            <I.CheckCircle2 className="w-3.5 h-3.5" /> {t.studio.gotIt}
          </button>
          <button
            onClick={() => {
              const n = new Set(missed);
              n.add(pool[idx]);
              setMissed(n);
              next();
            }}
            className="btn text-xs text-rose-700"
          >
            <I.X className="w-3.5 h-3.5" /> {t.studio.missed}
          </button>
        </div>
        <button onClick={next} className="btn text-xs">
          {t.studio.next} <I.ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
