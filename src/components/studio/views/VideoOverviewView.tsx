"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

interface Scene {
  narration: string;
  visual: string;
  duration_sec?: number;
}

interface Script {
  title: string;
  scenes: Scene[];
}

function parse(raw: string): Script | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const obj = JSON.parse(raw.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.scenes)) return null;
    return {
      title: String(obj.title || "Бейнешолу"),
      scenes: obj.scenes.map((s: unknown) => {
        const sc = s as { narration?: string; visual?: string; duration_sec?: number };
        return {
          narration: String(sc.narration || ""),
          visual: String(sc.visual || ""),
          duration_sec: Number(sc.duration_sec || 6),
        };
      }),
    };
  } catch {
    return null;
  }
}

export function VideoOverviewView({ artifact }: { artifact: StudioArtifact }) {
  const script = useMemo(() => parse(artifact.body), [artifact.body]);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const stopReq = useRef(false);

  useEffect(() => {
    return () => {
      stopReq.current = true;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  if (!script) {
    return (
      <div className="p-6 text-sm">
        Бейнені талдау мүмкін болмады.
        <pre className="mt-3 text-xs whitespace-pre-wrap">{artifact.body}</pre>
      </div>
    );
  }

  async function play() {
    setPlaying(true);
    stopReq.current = false;
    for (let i = idx; i < script!.scenes.length; i++) {
      if (stopReq.current) break;
      setIdx(i);
      const s = script!.scenes[i];
      const utter = new SpeechSynthesisUtterance(s.narration);
      utter.lang = "kk-KZ";
      await new Promise<void>((resolve) => {
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.speak(utter);
        } else {
          setTimeout(resolve, (s.duration_sec || 6) * 1000);
        }
      });
    }
    setPlaying(false);
  }

  function stop() {
    stopReq.current = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(script, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script!.title}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cur = script.scenes[idx];

  return (
    <div className="p-6">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-700 text-white">
        <div className="aspect-video flex flex-col p-8 text-center">
          <div className="text-xs uppercase opacity-60">{t.studio.videoOverview}</div>
          <h3 className="text-2xl font-semibold mt-2 mb-4">{script.title}</h3>
          <div className="flex-1 flex items-center justify-center">
            <div>
              <div className="text-sm opacity-70 italic mb-3">{cur.visual}</div>
              <div className="text-base">{cur.narration}</div>
            </div>
          </div>
          <div className="text-xs opacity-60 mt-2">
            {idx + 1} / {script.scenes.length}
          </div>
        </div>
        <div className="bg-black/40 p-3 flex items-center justify-center gap-3">
          {!playing ? (
            <button onClick={play} className="p-2 rounded-full bg-white text-black cursor-pointer">
              <I.Play className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={stop} className="p-2 rounded-full bg-white text-black cursor-pointer">
              <I.Pause className="w-4 h-4" />
            </button>
          )}
          <input
            type="range"
            min={0}
            max={script.scenes.length - 1}
            value={idx}
            onChange={(e) => setIdx(parseInt(e.target.value))}
            className="flex-1 max-w-md"
          />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button onClick={downloadJson} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> JSON
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-2">
        Шынайы AI-видео генерациясы үшін Veo/Sora секілді бөлек қызмет қажет. Бұл версия сценарий мен Web Speech дауысын біріктіреді.
      </p>
    </div>
  );
}
