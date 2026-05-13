"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import type { Source, SourceKind } from "@/lib/types";
import { AddSourceDialog } from "./AddSourceDialog";
import { DiscoverDialog } from "./DiscoverDialog";

function srcIcon(kind: SourceKind) {
  switch (kind) {
    case "pdf":
      return <I.FileText className="w-4 h-4 text-red-500" />;
    case "url":
      return <I.Link2 className="w-4 h-4 text-blue-500" />;
    case "youtube":
      return <I.Youtube className="w-4 h-4 text-red-600" />;
    case "image":
      return <I.Image className="w-4 h-4 text-emerald-500" />;
    case "audio":
      return <I.FileAudio className="w-4 h-4 text-orange-500" />;
    case "csv":
      return <I.Table className="w-4 h-4 text-emerald-600" />;
    case "docx":
      return <I.FileText className="w-4 h-4 text-blue-700" />;
    case "pptx":
      return <I.Presentation className="w-4 h-4 text-amber-600" />;
    case "assignment":
      return <I.BookOpen className="w-4 h-4 text-purple-600" />;
    default:
      return <I.FileText className="w-4 h-4 text-zinc-500" />;
  }
}

function SourceRow({ src }: { src: Source }) {
  const toggle = useApp((s) => s.toggleSource);
  const remove = useApp((s) => s.removeSource);
  const addArtifact = useApp((s) => s.addArtifact);
  const artifacts = useApp((s) => s.artifacts);
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);

  async function startPractice() {
    if (src.kind !== "assignment") return;
    // If there's already a practice artifact for this source, the user can
    // click it in the Studio list. Otherwise, generate the canonical solution
    // and create a new practice artifact.
    const existing = artifacts.find(
      (a) => a.kind === "practice" && a.body.includes(src.id),
    );
    if (existing) {
      // Surface the existing one (user can find it in Studio panel).
      const ev = new CustomEvent("openArtifact", { detail: existing.id });
      window.dispatchEvent(ev);
      return;
    }
    setPracticeLoading(true);
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "solve", assignmentSource: src }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "solve failed");
      const body = JSON.stringify({
        assignmentSourceId: src.id,
        solution: j.content,
      });
      const a = await addArtifact({
        notebookId: useApp.getState().currentNotebookId ?? "",
        kind: "practice",
        title: `${t.studio.practice}: ${src.title.slice(0, 40)}`,
        body,
        prompt: undefined,
        options: undefined,
      });
      const ev = new CustomEvent("openArtifact", { detail: a.id });
      window.dispatchEvent(ev);
    } finally {
      setPracticeLoading(false);
    }
  }

  return (
    <div
      className="group rounded-lg hover:bg-zinc-100 px-2 py-1.5"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => toggle(src.id, !src.enabled)}
          className="p-1 cursor-pointer"
          title={src.enabled ? t.sources.disable : t.sources.enable}
        >
          {src.enabled ? (
            <I.CheckSquare className="w-4 h-4 text-blue-600" />
          ) : (
            <I.Square className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        <button
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-2 flex-1 text-left cursor-pointer min-w-0"
        >
          {srcIcon(src.kind)}
          <span className="text-sm truncate" title={src.title}>
            {src.title}
          </span>
        </button>
        {hover && (
          <button
            onClick={() => remove(src.id)}
            className="p-1 rounded hover:bg-zinc-200 cursor-pointer"
            title={t.sources.deleteSource}
          >
            <I.Trash2 className="w-4 h-4 text-zinc-500" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="text-xs text-zinc-600 px-7 py-2 space-y-1">
          {src.kind === "assignment" && (
            <button
              onClick={startPractice}
              disabled={practiceLoading}
              className="btn btn-primary text-xs"
            >
              {practiceLoading ? (
                <I.Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <I.BookOpen className="w-3.5 h-3.5" />
              )}
              {t.studio.practice}
            </button>
          )}
          {src.url && (
            <div className="truncate">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {src.url}
              </a>
            </div>
          )}
          {src.topics && src.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {src.topics.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {src.summary && (
            <div className="text-zinc-700 whitespace-pre-wrap leading-snug">
              <strong className="text-zinc-900">{t.sources.summary}:</strong>{" "}
              {src.summary}
            </div>
          )}
          {!src.summary && (
            <div className="text-zinc-500 italic">{t.sources.summarizing}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function SourcesPanel({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: () => void }) {
  const sources = useApp((s) => s.sources);
  const toggleAll = useApp((s) => s.toggleAllSources);
  const [addOpen, setAddOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState<
    null | "discover" | "fast" | "deep"
  >(null);
  const allEnabled = sources.length > 0 && sources.every((s) => s.enabled);

  if (collapsed) {
    return (
      <aside className="w-12 bg-white rounded-2xl m-2 flex flex-col items-center py-3 gap-2 border border-border">
        <button onClick={onCollapse} className="p-2 hover:bg-zinc-100 rounded cursor-pointer">
          <I.PanelLeftClose className="w-5 h-5 rotate-180" />
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="p-2 hover:bg-zinc-100 rounded cursor-pointer"
          title={t.sources.add}
        >
          <I.Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => setDiscoverOpen("discover")}
          className="p-2 hover:bg-zinc-100 rounded cursor-pointer"
          title={t.sources.discover}
        >
          <I.Search className="w-5 h-5" />
        </button>
        {sources.slice(0, 12).map((s) => (
          <div key={s.id} title={s.title} className="p-1.5">
            {srcIcon(s.kind)}
          </div>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-[280px] bg-white rounded-2xl m-2 mr-1 flex flex-col border border-border min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-sm">{t.sources.title}</h2>
        <button onClick={onCollapse} className="p-1 hover:bg-zinc-100 rounded cursor-pointer">
          <I.PanelLeftClose className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 pt-3 space-y-2">
        <button
          onClick={() => setAddOpen(true)}
          className="w-full btn justify-start"
        >
          <I.Plus className="w-4 h-4" /> {t.sources.add}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDiscoverOpen("discover")}
            className="btn justify-center text-zinc-700"
            title={t.sources.discover}
          >
            <I.Globe className="w-4 h-4" />
            <span className="truncate text-xs">{t.sources.webMode}</span>
          </button>
          <button
            onClick={() => setDiscoverOpen("fast")}
            className="btn justify-center text-zinc-700"
            title={t.sources.discoverFast}
          >
            <I.Sparkles className="w-4 h-4" />
            <span className="truncate text-xs">{t.sources.fastResearch}</span>
          </button>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="px-3 pt-2 pb-1 flex items-center justify-between text-xs text-zinc-600">
          <button
            onClick={() => toggleAll(!allEnabled)}
            className="hover:text-zinc-900 cursor-pointer"
          >
            {allEnabled ? t.sources.deselectAll : t.sources.selectAll}
          </button>
          <span>{sources.filter((s) => s.enabled).length} / {sources.length}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 min-h-0">
        {sources.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-500 space-y-2">
            <I.FileText className="w-6 h-6 mx-auto text-zinc-400" />
            <div className="font-medium text-zinc-700">{t.sources.saved}</div>
            <div className="leading-relaxed">{t.sources.savedHelp}</div>
          </div>
        )}
        {sources.map((s) => (
          <SourceRow key={s.id} src={s} />
        ))}
      </div>

      {addOpen && <AddSourceDialog onClose={() => setAddOpen(false)} />}
      {discoverOpen && (
        <DiscoverDialog
          onClose={() => setDiscoverOpen(null)}
          initialMode={discoverOpen}
        />
      )}
    </aside>
  );
}
