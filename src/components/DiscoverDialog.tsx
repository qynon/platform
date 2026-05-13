"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";

interface DiscoverResult {
  title: string;
  url: string;
  summary: string;
}

export function DiscoverDialog({
  onClose,
  initialMode = "discover",
}: {
  onClose: () => void;
  initialMode?: "discover" | "fast" | "deep";
}) {
  const addSource = useApp((s) => s.addSource);
  const updateSource = useApp((s) => s.updateSource);
  const setDeepRunning = useApp((s) => s.setDeepResearchRunning);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"discover" | "fast" | "deep">(initialMode);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiscoverResult[] | null>(null);
  const [deepReport, setDeepReport] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function go(useMode: typeof mode = mode) {
    if (!query.trim()) return;
    setError(null);
    setResults(null);
    setDeepReport(null);
    setSelected(new Set());
    setLoading(true);
    if (useMode === "deep") setDeepRunning(true);
    try {
      const r = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode: useMode }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Research failed");
      if (useMode === "deep") {
        setDeepReport(j.report || "");
        const fromCitations: DiscoverResult[] = (j.webCitations || []).map(
          (url: string, i: number) => ({
            title: `Дереккөз ${i + 1}`,
            url,
            summary: "",
          }),
        );
        const fromSR: DiscoverResult[] = (j.searchResults || []).map(
          (s: { title?: string; url?: string; snippet?: string }) => ({
            title: s.title || s.url || "",
            url: s.url || "",
            summary: s.snippet || "",
          }),
        );
        setResults([...fromSR, ...fromCitations].filter((x) => x.url));
      } else {
        setResults(j.sources || []);
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
      setDeepRunning(false);
    }
  }

  async function importSelected() {
    if (!results) return;
    const picks = results.filter((r) => selected.has(r.url));
    setLoading(true);
    try {
      for (const r of picks) {
        try {
          const resp = await fetch("/api/sources/url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: r.url }),
          });
          const j = await resp.json();
          if (!resp.ok || j.error) continue;
          const src = await addSource({
            kind: j.kind,
            title: r.title || j.title,
            content: j.content,
            url: j.url,
            mime: j.mime,
            bytes: j.bytes,
            summary: r.summary || undefined,
            topics: undefined,
            notebookId: useApp.getState().currentNotebookId ?? "",
          });
          fetch("/api/sources/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: j.content, title: j.title }),
          })
            .then((rr) => rr.json())
            .then((jj: { summary?: string; topics?: string[] }) => {
              if (jj.summary) updateSource(src.id, { summary: jj.summary, topics: jj.topics });
            })
            .catch(() => undefined);
        } catch {
          /* skip */
        }
      }
      if (deepReport) {
        await addSource({
          kind: "paste",
          title: `Терең зерттеу: ${query}`,
          content: deepReport,
          notebookId: useApp.getState().currentNotebookId ?? "",
          summary: undefined,
          topics: undefined,
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <I.Search className="w-5 h-5" /> {t.sources.discover}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
            <I.X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 border border-zinc-200 rounded-full pl-3 pr-1 py-1">
            <I.Globe className="w-4 h-4 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.sources.discoverPlaceholder}
              className="flex-1 outline-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") go();
              }}
            />
            <button
              onClick={() => go()}
              disabled={loading || !query.trim()}
              className="p-2 rounded-full bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
            >
              <I.Search className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => {
                setMode("discover");
                go("discover");
              }}
              className={`btn ${mode === "discover" ? "btn-primary" : ""}`}
            >
              <I.Sparkles className="w-4 h-4" /> Discover Sources
            </button>
            <button
              onClick={() => {
                setMode("fast");
                go("fast");
              }}
              className={`btn ${mode === "fast" ? "btn-primary" : ""}`}
            >
              {t.sources.discoverFast}
            </button>
            <button
              onClick={() => {
                setMode("deep");
                go("deep");
              }}
              className={`btn ${mode === "deep" ? "btn-primary" : ""}`}
            >
              {t.sources.discoverDeep}
            </button>
          </div>

          {loading && (
            <div className="text-sm text-zinc-600 flex items-center gap-2">
              <I.Loader2 className="w-4 h-4 animate-spin" />
              {mode === "deep" ? t.sources.deepResearchRunning : t.common.loading}
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {deepReport && (
            <div className="mb-4 bg-zinc-50 rounded-xl p-4 text-sm whitespace-pre-wrap markdown-body">
              {deepReport}
            </div>
          )}
          {results && (
            <>
              <div className="text-xs text-zinc-500 mb-2 flex items-center justify-between">
                <span>{t.sources.discoverResults}</span>
                <span>{selected.size} / {results.length}</span>
              </div>
              <div className="space-y-2">
                {results.map((r) => (
                  <label
                    key={r.url}
                    className="flex gap-3 items-start p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(r.url)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.url);
                        else next.delete(r.url);
                        setSelected(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.title}</div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.url}
                      </a>
                      {r.summary && (
                        <div className="text-xs text-zinc-600 mt-1">{r.summary}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {results && results.length > 0 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <button onClick={onClose} className="btn">
              {t.common.cancel}
            </button>
            <button
              onClick={importSelected}
              disabled={loading || selected.size === 0}
              className="btn btn-primary disabled:opacity-50"
            >
              {loading && <I.Loader2 className="w-4 h-4 animate-spin" />}
              {t.sources.importSelected}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
