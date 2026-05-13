"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import type { Note } from "@/lib/types";

export function NotesList() {
  const notes = useApp((s) => s.notes);
  const addNote = useApp((s) => s.addNote);
  const updateNote = useApp((s) => s.updateNote);
  const removeNote = useApp((s) => s.removeNote);
  const addSource = useApp((s) => s.addSource);
  const sources = useApp((s) => s.sources);
  const [open, setOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickAction, setQuickAction] = useState<string | null>(null);

  async function runQuickAction(
    action: "combine" | "feedback" | "overview" | "outline" | "study-guide" | "ideas",
  ) {
    const chosen = notes.filter((n) => selected.has(n.id));
    if (chosen.length === 0) return;
    setQuickAction(action);
    try {
      const r = await fetch("/api/notes/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: chosen, sources, action }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "failed");
      await addNote({
        notebookId: useApp.getState().currentNotebookId ?? "",
        title: `${action} (${chosen.length})`,
        content: j.content,
        fromChat: false,
        pinned: false,
      });
      setSelected(new Set());
    } catch {
      /* surfaced via UI elsewhere */
    } finally {
      setQuickAction(null);
    }
  }

  async function convertToSource(n: Note) {
    await addSource({
      notebookId: useApp.getState().currentNotebookId ?? "",
      kind: "text",
      title: `Note: ${n.title || n.content.slice(0, 40)}`,
      content: n.content,
      summary: undefined,
      topics: undefined,
    });
    await removeNote(n.id);
  }

  async function convertAllToSource() {
    const merged = notes.map((n) => `## ${n.title || "(untitled)"}\n\n${n.content}`).join("\n\n");
    await addSource({
      notebookId: useApp.getState().currentNotebookId ?? "",
      kind: "text",
      title: `All notes — ${new Date().toLocaleDateString()}`,
      content: merged,
      summary: undefined,
      topics: undefined,
    });
  }

  return (
    <div className="border-t flex flex-col">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-zinc-50 cursor-pointer text-sm"
      >
        <span className="font-semibold">{t.studio.notes}</span>
        <I.ChevronDown className={`w-4 h-4 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="w-full btn justify-center text-zinc-700"
            >
              <I.Plus className="w-4 h-4" /> {t.studio.addNote}
            </button>
          ) : (
            <div className="border border-zinc-200 rounded-lg p-2 space-y-2 bg-zinc-50">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Атау"
                className="w-full text-sm outline-none bg-transparent border-b border-zinc-200 py-1"
              />
              <textarea
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder="..."
                rows={4}
                className="w-full text-sm outline-none bg-transparent resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setCreating(false);
                    setDraft({ title: "", content: "" });
                  }}
                >
                  {t.common.cancel}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!draft.content.trim()}
                  onClick={async () => {
                    await addNote({
                      notebookId: useApp.getState().currentNotebookId ?? "",
                      title: draft.title.trim() || draft.content.slice(0, 40),
                      content: draft.content,
                      fromChat: false,
                      pinned: false,
                    });
                    setCreating(false);
                    setDraft({ title: "", content: "" });
                  }}
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          )}

          {selected.size > 0 && (
            <div className="border border-zinc-200 rounded-lg p-2 bg-blue-50/40 text-xs space-y-1.5">
              <div className="font-semibold">
                {t.studio.notes_quickActions} ({selected.size})
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  ["combine", t.studio.notes_combine],
                  ["feedback", t.studio.notes_feedback],
                  ["overview", t.studio.notes_overview],
                  ["outline", t.studio.notes_outline],
                  ["study-guide", t.studio.notes_studyGuide],
                  ["ideas", t.studio.notes_ideas],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    disabled={!!quickAction}
                    className="btn text-xs"
                    onClick={() => runQuickAction(action as "combine")}
                  >
                    {quickAction === action && <I.Loader2 className="w-3 h-3 animate-spin" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {notes.length === 0 && (
              <div className="text-center text-xs text-zinc-500 py-4">
                <I.StickyNote className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                Жазбалар әлі жоқ
              </div>
            )}
            {notes.map((n) => (
              <NoteItem
                key={n.id}
                note={n}
                selected={selected.has(n.id)}
                onToggle={() => {
                  const next = new Set(selected);
                  if (next.has(n.id)) next.delete(n.id);
                  else next.add(n.id);
                  setSelected(next);
                }}
                onDelete={() => removeNote(n.id)}
                onConvert={() => convertToSource(n)}
                onEdit={(content) => updateNote(n.id, { content })}
              />
            ))}
          </div>
          {notes.length > 1 && (
            <button onClick={convertAllToSource} className="w-full btn text-xs">
              {t.studio.convertAllToSource}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({
  note,
  selected,
  onToggle,
  onDelete,
  onConvert,
  onEdit,
}: {
  note: Note;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onEdit: (content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(note.content);

  return (
    <div className="border border-zinc-200 rounded-lg p-2 bg-white text-xs">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5"
        />
        <button
          onClick={() => setOpen((x) => !x)}
          className="flex-1 text-left font-medium truncate cursor-pointer"
        >
          {note.title || "(жазба)"}
          {note.fromChat && <span className="ml-1 text-blue-600">(чат)</span>}
        </button>
        <button onClick={onConvert} className="p-1 rounded hover:bg-zinc-100 cursor-pointer" title={t.studio.convertToSource}>
          <I.FileText className="w-3.5 h-3.5 text-zinc-500" />
        </button>
        <button onClick={onDelete} className="p-1 rounded hover:bg-zinc-100 cursor-pointer">
          <I.Trash2 className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      </div>
      {open && (
        <div className="mt-2">
          {note.fromChat ? (
            <pre className="whitespace-pre-wrap text-xs text-zinc-700 leading-relaxed">{note.content}</pre>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={() => {
                if (content !== note.content) onEdit(content);
              }}
              rows={5}
              className="w-full text-xs outline-none bg-transparent resize-y border border-zinc-100 rounded p-2"
            />
          )}
        </div>
      )}
    </div>
  );
}
