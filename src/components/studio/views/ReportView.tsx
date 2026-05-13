"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

export function ReportView({ artifact }: { artifact: StudioArtifact }) {
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
    <div className="p-6">
      <div className="flex justify-end mb-2">
        <button onClick={downloadMd} className="btn text-xs">
          <I.Download className="w-3.5 h-3.5" /> {t.studio.download} (.md)
        </button>
      </div>
      <article className="markdown-body prose-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.body}</ReactMarkdown>
      </article>
    </div>
  );
}
