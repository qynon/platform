"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import { COMMON_EMOJIS } from "@/lib/emoji";

export function NotebookHeader({ onBack }: { onBack: () => void }) {
  const nb = useApp((s) =>
    s.notebooks.find((n) => n.id === s.currentNotebookId),
  );
  const rename = useApp((s) => s.renameNotebook);
  const setEmoji = useApp((s) => s.setNotebookEmoji);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draft, setDraft] = useState(nb?.title ?? "");
  const [showEmoji, setShowEmoji] = useState(false);

  if (!nb) return null;

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-border">
      <button
        onClick={onBack}
        className="p-2 rounded-full hover:bg-zinc-100 cursor-pointer"
        title={t.app.notebooks}
      >
        <I.ArrowLeft className="w-5 h-5" />
      </button>
      <div className="relative">
        <button
          onClick={() => setShowEmoji((x) => !x)}
          className="text-2xl px-1 rounded hover:bg-zinc-100 cursor-pointer"
          title={t.app.emojiPicker}
        >
          {nb.emoji}
        </button>
        {showEmoji && (
          <div className="absolute z-30 top-full left-0 mt-2 bg-white border border-border rounded-xl shadow-lg p-2 grid grid-cols-8 gap-1 w-[280px]">
            {COMMON_EMOJIS.map((e) => (
              <button
                key={e}
                className="text-xl p-1 rounded hover:bg-zinc-100 cursor-pointer"
                onClick={() => {
                  setEmoji(nb.id, e, true);
                  setShowEmoji(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      {editingTitle ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditingTitle(false);
            if (draft.trim() && draft !== nb.title) rename(nb.id, draft.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditingTitle(false);
              if (draft.trim() && draft !== nb.title) rename(nb.id, draft.trim());
            }
            if (e.key === "Escape") {
              setEditingTitle(false);
              setDraft(nb.title);
            }
          }}
          className="text-base font-medium bg-transparent outline-none border-b border-blue-500"
        />
      ) : (
        <button
          className="text-base font-medium cursor-text px-1 rounded hover:bg-zinc-100"
          onClick={() => {
            setDraft(nb.title);
            setEditingTitle(true);
          }}
        >
          {nb.title}
        </button>
      )}
      <div className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
        <button className="btn">
          <I.Sparkles className="w-4 h-4" /> {t.app.analytics}
        </button>
        <button className="btn">
          <I.Share2 className="w-4 h-4" /> {t.app.share}
        </button>
        <button className="btn">
          <I.Settings className="w-4 h-4" /> {t.app.settings}
        </button>
        <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
          {t.app.pro}
        </span>
      </div>
    </header>
  );
}
