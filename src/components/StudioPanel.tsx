"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import type { StudioArtifact, StudioArtifactKind } from "@/lib/types";
import { StudioViewer } from "./studio/StudioViewer";
import { NotesList } from "./NotesList";
import { CustomizeDialog } from "./studio/CustomizeDialog";

interface CardDef {
  kind: StudioArtifactKind;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CARDS: CardDef[] = [
  { kind: "audio-overview", label: t.studio.audioOverview, icon: <I.AudioLines className="w-4 h-4" />, color: "bg-blue-50" },
  { kind: "slides", label: t.studio.slideDeck, icon: <I.Presentation className="w-4 h-4" />, color: "bg-amber-50" },
  { kind: "video-overview", label: t.studio.videoOverview, icon: <I.Film className="w-4 h-4" />, color: "bg-emerald-50" },
  { kind: "mindmap", label: t.studio.mindMap, icon: <I.Brain className="w-4 h-4" />, color: "bg-pink-50" },
  { kind: "report", label: t.studio.reports, icon: <I.ScrollText className="w-4 h-4" />, color: "bg-violet-50" },
  { kind: "flashcards", label: t.studio.flashcards, icon: <I.ListTodo className="w-4 h-4" />, color: "bg-orange-50" },
  { kind: "quiz", label: t.studio.quiz, icon: <I.ClipboardCheck className="w-4 h-4" />, color: "bg-cyan-50" },
  { kind: "infographic", label: t.studio.infographic, icon: <I.Image className="w-4 h-4" />, color: "bg-rose-50" },
  { kind: "data-table", label: t.studio.dataTable, icon: <I.Table className="w-4 h-4" />, color: "bg-lime-50" },
];

export function StudioPanel({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: () => void }) {
  const sources = useApp((s) => s.sources);
  const artifacts = useApp((s) => s.artifacts);
  const addArtifact = useApp((s) => s.addArtifact);

  const [view, setView] = useState<StudioArtifact | null>(null);
  const [customizing, setCustomizing] = useState<StudioArtifactKind | null>(null);
  const [generating, setGenerating] = useState<StudioArtifactKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSources = sources.some((s) => s.enabled);

  // Allow other components (e.g. SourcesPanel) to request opening an artifact
  // viewer via a `window` event.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      const a = artifacts.find((x) => x.id === detail);
      if (a) setView(a);
    }
    window.addEventListener("openArtifact", onOpen);
    return () => window.removeEventListener("openArtifact", onOpen);
  }, [artifacts]);

  async function generate(
    kind: StudioArtifactKind,
    options: Record<string, string | number | boolean> = {},
    customPrompt = "",
  ) {
    setGenerating(kind);
    setError(null);
    try {
      const r = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, sources, options, customPrompt }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Generation failed");
      const a = await addArtifact({
        notebookId: useApp.getState().currentNotebookId ?? "",
        kind,
        title: defaultTitle(kind),
        body: j.body,
        prompt: j.prompt,
        options,
      });
      setView(a);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setGenerating(null);
    }
  }

  if (collapsed) {
    return (
      <aside className="w-12 bg-white rounded-2xl m-2 flex flex-col items-center py-3 gap-2 border border-border">
        <button onClick={onCollapse} className="p-2 hover:bg-zinc-100 rounded cursor-pointer">
          <I.PanelRightClose className="w-5 h-5 rotate-180" />
        </button>
        {CARDS.slice(0, 9).map((c) => (
          <button
            key={c.kind}
            disabled={!hasSources}
            onClick={() => generate(c.kind)}
            className="p-2 hover:bg-zinc-100 rounded cursor-pointer disabled:opacity-40"
            title={c.label}
          >
            {c.icon}
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside className="w-[320px] bg-white rounded-2xl m-2 ml-1 flex flex-col border border-border min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">{t.studio.title}</h2>
        <button onClick={onCollapse} className="p-1 hover:bg-zinc-100 rounded cursor-pointer">
          <I.PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 grid grid-cols-3 gap-2">
        {CARDS.map((c) => (
          <button
            key={c.kind}
            disabled={!hasSources || generating === c.kind}
            onClick={() => generate(c.kind)}
            className={`${c.color} rounded-xl p-2.5 group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm transition-shadow text-left flex flex-col gap-1`}
            title={c.label}
          >
            <div className="flex items-center justify-between">
              <div className="text-zinc-800">
                {generating === c.kind ? (
                  <I.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  c.icon
                )}
              </div>
              {hasSources && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomizing(c.kind);
                  }}
                  className="p-0.5 hover:bg-white/60 rounded cursor-pointer"
                  title={t.studio.customize}
                >
                  <I.Pencil className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="text-[11px] font-medium text-zinc-800 leading-tight truncate">
              {c.label}
            </div>
          </button>
        ))}
      </div>

      {!hasSources && (
        <div className="px-4 py-3 text-xs text-zinc-500 text-center">{t.studio.noSourcesYet}</div>
      )}
      {error && (
        <div className="px-4 py-2 text-xs text-red-600">{error}</div>
      )}

      <div className="border-t mt-1 flex-1 min-h-0 overflow-y-auto">
        {artifacts.length === 0 && (
          <div className="px-6 py-8 text-center text-xs text-zinc-500 space-y-2">
            <I.Sparkles className="w-6 h-6 mx-auto text-zinc-400" />
            <div className="font-medium text-zinc-700">{t.studio.helpTitle}</div>
            <div className="leading-relaxed">{t.studio.helpBody}</div>
          </div>
        )}
        <div className="px-2 py-2 space-y-1">
          {artifacts.map((a) => (
            <button
              key={a.id}
              onClick={() => setView(a)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-100 flex items-center gap-2 text-sm cursor-pointer"
            >
              <span className="text-zinc-500">{iconFor(a.kind)}</span>
              <span className="flex-1 truncate">{a.title}</span>
              <span className="text-[10px] text-zinc-400">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      </div>

      <NotesList />

      {view && <StudioViewer artifact={view} onClose={() => setView(null)} />}
      {customizing && (
        <CustomizeDialog
          kind={customizing}
          onClose={() => setCustomizing(null)}
          onGenerate={(opts, customPrompt) => {
            setCustomizing(null);
            generate(customizing, opts, customPrompt);
          }}
        />
      )}
    </aside>
  );
}

function iconFor(kind: StudioArtifactKind): React.ReactNode {
  const d = CARDS.find((c) => c.kind === kind);
  return d?.icon ?? <I.FileText className="w-4 h-4" />;
}

function defaultTitle(kind: StudioArtifactKind): string {
  const d = CARDS.find((c) => c.kind === kind);
  if (d) return d.label;
  const fallback: Partial<Record<StudioArtifactKind, string>> = {
    faq: t.studio.faq,
    "study-guide": t.studio.studyGuide,
    briefing: t.studio.briefingDoc,
  };
  return fallback[kind] || kind;
}
