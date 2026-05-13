"use client";
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Papa from "papaparse";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

function parseMarkdownTable(md: string): { headers: string[]; rows: string[][] } | null {
  const lines = md.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return null;
  const headers = lines[0].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
  const rows = lines
    .slice(2)
    .map((l) => l.split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1));
  return { headers, rows };
}

export function DataTableView({ artifact }: { artifact: StudioArtifact }) {
  const parsed = useMemo(() => parseMarkdownTable(artifact.body), [artifact.body]);

  function downloadCsv() {
    if (!parsed) return;
    const csv = Papa.unparse([parsed.headers, ...parsed.rows]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="flex justify-end mb-2">
        <button onClick={downloadCsv} disabled={!parsed} className="btn text-xs disabled:opacity-50">
          <I.Download className="w-3.5 h-3.5" /> {t.studio.download} (.csv)
        </button>
      </div>
      <article className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.body}</ReactMarkdown>
      </article>
    </div>
  );
}
