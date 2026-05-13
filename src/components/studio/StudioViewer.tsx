"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { I } from "../Icon";
import type { StudioArtifact } from "@/lib/types";
import { useApp } from "@/lib/store";
import { ReportView } from "./views/ReportView";
import { DataTableView } from "./views/DataTableView";
import { MindMapView } from "./views/MindMapView";
import { FlashcardsView } from "./views/FlashcardsView";
import { QuizView } from "./views/QuizView";
import { SlidesView } from "./views/SlidesView";
import { InfographicView } from "./views/InfographicView";
import { AudioOverviewView } from "./views/AudioOverviewView";
import { VideoOverviewView } from "./views/VideoOverviewView";
import { PracticeView } from "./views/PracticeView";

export function StudioViewer({
  artifact,
  onClose,
}: {
  artifact: StudioArtifact;
  onClose: () => void;
}) {
  const updateArtifact = useApp((s) => s.updateArtifact);
  const removeArtifact = useApp((s) => s.removeArtifact);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(artifact.title);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b flex items-center gap-2">
          {renaming ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (draftTitle.trim() && draftTitle !== artifact.title)
                  updateArtifact(artifact.id, { title: draftTitle.trim() });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setRenaming(false);
                  if (draftTitle.trim()) updateArtifact(artifact.id, { title: draftTitle.trim() });
                }
                if (e.key === "Escape") {
                  setRenaming(false);
                  setDraftTitle(artifact.title);
                }
              }}
              className="font-semibold bg-transparent outline-none border-b border-blue-500 flex-1"
            />
          ) : (
            <button
              className="font-semibold flex-1 text-left cursor-text hover:bg-zinc-50 px-1 rounded"
              onClick={() => setRenaming(true)}
            >
              {artifact.title}
            </button>
          )}
          {artifact.prompt && (
            <button
              onClick={() => setShowPrompt(true)}
              className="btn text-xs"
              title={t.studio.viewPrompt}
            >
              <I.Eye className="w-3.5 h-3.5" /> {t.studio.viewPrompt}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm("Жоюды растайсыз ба?")) {
                removeArtifact(artifact.id);
                onClose();
              }
            }}
            className="btn text-xs text-red-600"
          >
            <I.Trash2 className="w-3.5 h-3.5" /> {t.studio.delete}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
            <I.X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {renderArtifact(artifact)}
        </div>
        {showPrompt && artifact.prompt && (
          <div
            className="absolute inset-0 z-10 bg-white/95 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{t.studio.viewPrompt}</h4>
              <button onClick={() => setShowPrompt(false)} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
                <I.X className="w-5 h-5" />
              </button>
            </div>
            <pre className="mt-3 text-xs whitespace-pre-wrap text-zinc-700">{artifact.prompt}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function renderArtifact(a: StudioArtifact) {
  switch (a.kind) {
    case "report":
    case "faq":
    case "study-guide":
    case "briefing":
      return <ReportView artifact={a} />;
    case "data-table":
      return <DataTableView artifact={a} />;
    case "mindmap":
      return <MindMapView artifact={a} />;
    case "flashcards":
      return <FlashcardsView artifact={a} />;
    case "quiz":
      return <QuizView artifact={a} />;
    case "slides":
      return <SlidesView artifact={a} />;
    case "infographic":
      return <InfographicView artifact={a} />;
    case "audio-overview":
      return <AudioOverviewView artifact={a} />;
    case "video-overview":
      return <VideoOverviewView artifact={a} />;
    case "practice":
      return <PracticeView artifact={a} />;
    default:
      return <pre className="p-4 text-sm whitespace-pre-wrap">{a.body}</pre>;
  }
}
