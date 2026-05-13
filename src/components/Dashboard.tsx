"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";

export function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const init = useApp((s) => s.init);
  const notebooks = useApp((s) => s.notebooks);
  const createNotebook = useApp((s) => s.createNotebook);
  const removeNotebook = useApp((s) => s.removeNotebook);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f3f6]">
      <header className="px-6 py-4 bg-white border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
          <h1 className="text-lg font-semibold">{t.app.name}</h1>
        </div>
        <button
          onClick={async () => {
            setCreating(true);
            const nb = await createNotebook();
            setCreating(false);
            onOpen(nb.id);
          }}
          className="btn btn-primary"
        >
          {creating ? <I.Loader2 className="w-4 h-4 animate-spin" /> : <I.Plus className="w-4 h-4" />}
          {t.app.newNotebook}
        </button>
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">{t.app.notebooks}</h2>
          {notebooks.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-3">📚</div>
              <p className="text-zinc-600 mb-4">
                Әзірше блокноттар жоқ. Жаңасын жасаңыз.
              </p>
              <button
                onClick={async () => {
                  const nb = await createNotebook();
                  onOpen(nb.id);
                }}
                className="btn btn-primary"
              >
                <I.Plus className="w-4 h-4" /> {t.app.newNotebook}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  className="group bg-white rounded-2xl p-5 border border-border hover:shadow-md cursor-pointer relative"
                  onClick={() => onOpen(nb.id)}
                >
                  <div className="text-3xl">{nb.emoji}</div>
                  <h3 className="mt-3 font-medium truncate">{nb.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Жаңартылды: {new Date(nb.updatedAt).toLocaleDateString()}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.app.confirmDelete)) removeNotebook(nb.id);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-zinc-100 cursor-pointer"
                    title={t.app.deleteNotebook}
                  >
                    <I.Trash2 className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <footer className="py-3 text-center text-xs text-zinc-500 bg-white border-t">
        Perplexity API негізіндегі ашық NotebookLM клоны
      </footer>
    </div>
  );
}
