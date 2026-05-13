"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

interface Line {
  speaker: string;
  text: string;
}

function parseScript(raw: string): Line[] {
  const lines: Line[] = [];
  const re = /^([A-Za-zА-Яа-яҚқҒғҢңӨөҰұҮүҺһЁёІі\-\s]{1,30}):\s*(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const speaker = m[1].trim();
    const text = m[2].trim();
    if (text) lines.push({ speaker, text });
  }
  if (lines.length === 0) {
    raw.split(/\n+/).forEach((p) => {
      const trimmed = p.trim();
      if (trimmed) lines.push({ speaker: "Narrator", text: trimmed });
    });
  }
  return lines;
}

function chooseVoice(
  voices: SpeechSynthesisVoice[],
  preferLang: string,
  varyKey: string,
): SpeechSynthesisVoice | undefined {
  const langMatches = voices.filter((v) => v.lang?.toLowerCase().startsWith(preferLang.toLowerCase()));
  const pool = langMatches.length > 0 ? langMatches : voices;
  if (pool.length === 0) return undefined;
  let h = 0;
  for (let i = 0; i < varyKey.length; i++) h = (h * 31 + varyKey.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

export function AudioOverviewView({ artifact }: { artifact: StudioArtifact }) {
  const lines = useMemo(() => parseScript(artifact.body), [artifact.body]);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState(1);
  const stopRequested = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  async function play() {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Браузер дауыс шығаруды (TTS) қолдамайды");
      return;
    }
    stopRequested.current = false;
    setPlaying(true);
    for (let i = idx; i < lines.length; i++) {
      if (stopRequested.current) break;
      setIdx(i);
      const line = lines[i];
      const utter = new SpeechSynthesisUtterance(line.text);
      utter.rate = rate;
      utter.voice = chooseVoice(voices, "kk", line.speaker) || chooseVoice(voices, "ru", line.speaker) || chooseVoice(voices, "en", line.speaker) || null;
      utter.lang = utter.voice?.lang || "kk-KZ";
      await new Promise<void>((resolve) => {
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      });
    }
    setPlaying(false);
  }

  function stop() {
    stopRequested.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  function downloadTxt() {
    const blob = new Blob([artifact.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 p-6 text-center mb-4">
        <I.AudioLines className="w-12 h-12 mx-auto text-blue-600 mb-2" />
        <h3 className="font-semibold">{artifact.title}</h3>
        <p className="text-xs text-zinc-600 mt-1">
          Браузерлік TTS (Web Speech API). Дауыс сапасы құрылғыға тәуелді.
        </p>
        <div className="mt-4 flex justify-center items-center gap-2">
          {!playing ? (
            <button onClick={play} className="btn btn-primary">
              <I.Play className="w-4 h-4" /> {t.studio.play}
            </button>
          ) : (
            <button onClick={stop} className="btn btn-primary">
              <I.Pause className="w-4 h-4" /> {t.studio.pause}
            </button>
          )}
          <select
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="text-xs border border-zinc-200 rounded-full px-2 py-1 outline-none"
          >
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          <button onClick={downloadTxt} className="btn text-xs">
            <I.Download className="w-3.5 h-3.5" /> .txt
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2 text-sm ${
              i === idx && playing
                ? "bg-blue-50 border border-blue-300"
                : "bg-white border border-zinc-100"
            }`}
            onClick={() => setIdx(i)}
          >
            <div className="text-[11px] uppercase text-zinc-500 mb-0.5">{l.speaker}</div>
            <div>{l.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
