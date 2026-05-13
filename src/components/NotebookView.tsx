"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { NotebookHeader } from "./NotebookHeader";
import { SourcesPanel } from "./SourcesPanel";
import { ChatPanel } from "./ChatPanel";
import { StudioPanel } from "./StudioPanel";

export function NotebookView({ id, onBack }: { id: string; onBack: () => void }) {
  const selectNotebook = useApp((s) => s.selectNotebook);
  const init = useApp((s) => s.init);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      await init();
      await selectNotebook(id);
    })();
  }, [id, init, selectNotebook]);

  return (
    <div className="h-screen flex flex-col bg-[#f1f3f6]">
      <NotebookHeader onBack={onBack} />
      <div className="flex-1 flex min-h-0">
        <SourcesPanel collapsed={leftCollapsed} onCollapse={() => setLeftCollapsed(!leftCollapsed)} />
        <ChatPanel />
        <StudioPanel collapsed={rightCollapsed} onCollapse={() => setRightCollapsed(!rightCollapsed)} />
      </div>
    </div>
  );
}
