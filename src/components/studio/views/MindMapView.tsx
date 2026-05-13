"use client";
import { useEffect, useRef } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

export function MindMapView({ artifact }: { artifact: StudioArtifact }) {
  const ref = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      const { Transformer } = await import("markmap-lib");
      const markmapView = await import("markmap-view");
      if (cancelled) return;
      const transformer = new Transformer();
      const { root } = transformer.transform(artifact.body);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.style.width = "100%";
      svg.style.height = "70vh";
      svgRef.current = svg;
      ref.current.innerHTML = "";
      ref.current.appendChild(svg);
      const mm = markmapView.Markmap.create(svg, undefined, root);
      mm.fit();
    })();
    return () => {
      cancelled = true;
    };
  }, [artifact.body]);

  function downloadSvg() {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadMd() {
    const blob = new Blob([artifact.body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4">
      <div className="flex justify-end gap-2 mb-2">
        <button onClick={downloadSvg} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> SVG
        </button>
        <button onClick={downloadMd} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> {t.studio.download} (.md)
        </button>
      </div>
      <div ref={ref} className="border border-zinc-200 rounded-xl bg-zinc-50" />
    </div>
  );
}
