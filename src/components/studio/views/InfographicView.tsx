"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";

function sanitiseHtml(raw: string): string {
  // Extract from <html ...>...</html> or first <body>...</body>; strip <script>.
  let html = raw;
  const htmlMatch = raw.match(/<html[\s\S]*?<\/html>/i);
  if (htmlMatch) html = htmlMatch[0];
  else {
    const bodyMatch = raw.match(/<body[\s\S]*?<\/body>/i);
    if (bodyMatch) html = `<!doctype html><html><head><meta charset="utf-8"/></head>${bodyMatch[0]}</html>`;
  }
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

export function InfographicView({ artifact }: { artifact: StudioArtifact }) {
  const html = useMemo(() => sanitiseHtml(artifact.body), [artifact.body]);
  const ref = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(1);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const doc = f.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  async function downloadPng() {
    if (!ref.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const doc = ref.current.contentDocument;
      if (!doc) return;
      const target = doc.body;
      const canvas = await html2canvas(target, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: 2,
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${artifact.title}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setGenerating(false);
    }
  }

  function downloadHtml() {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-end gap-2 mb-2">
        <button onClick={() => setZoom(Math.max(0.3, zoom - 0.1))} className="btn text-xs">−</button>
        <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="btn text-xs">+</button>
        <button onClick={downloadPng} disabled={generating} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> PNG
        </button>
        <button onClick={downloadHtml} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> HTML
        </button>
      </div>
      <div className="border border-zinc-200 rounded-xl overflow-auto bg-zinc-50 h-[70vh]">
        <iframe
          ref={ref}
          sandbox="allow-same-origin"
          style={{
            border: 0,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
          title={artifact.title}
        />
      </div>
    </div>
  );
}
