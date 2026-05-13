"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import type { ParsedSource } from "@/lib/parsers";
import type { AssignmentSpec } from "@/lib/types";

type Tab = "files" | "url" | "paste" | "assignment";

export function AddSourceDialog({ onClose }: { onClose: () => void }) {
  const addSource = useApp((s) => s.addSource);
  const updateSource = useApp((s) => s.updateSource);
  const [tab, setTab] = useState<Tab>("files");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleParsed(parsed: ParsedSource & { assignment?: AssignmentSpec }) {
    const src = await addSource({
      kind: parsed.kind,
      title: parsed.title,
      content: parsed.content,
      url: parsed.url,
      mime: parsed.mime,
      bytes: parsed.bytes,
      imageDataUri: parsed.imageDataUri,
      assignment: parsed.assignment,
      summary: undefined,
      topics: undefined,
      notebookId: useApp.getState().currentNotebookId ?? "",
    });
    // fire-and-forget summarisation
    fetch("/api/sources/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: parsed.content, title: parsed.title }),
    })
      .then((r) => r.json())
      .then((j: { summary?: string; topics?: string[]; error?: string }) => {
        if (j.summary) {
          updateSource(src.id, { summary: j.summary, topics: j.topics });
        }
      })
      .catch(() => undefined);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    setImporting(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        const r = await fetch("/api/sources/upload", { method: "POST", body: form });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || `Upload failed: ${f.name}`);
        await handleParsed(j as ParsedSource);
      }
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  }

  async function importUrl() {
    if (!url.trim()) return;
    setError(null);
    setImporting(true);
    try {
      const r = await fetch("/api/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Import failed");
      await handleParsed(j as ParsedSource);
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  }

  async function importText() {
    if (!text.trim()) return;
    setError(null);
    setImporting(true);
    try {
      await handleParsed({
        kind: "paste",
        title: pasteTitle.trim() || t.sources.pastedText,
        content: text.trim(),
        mime: "text/plain",
      });
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  }

  // --- Assignment tab state ---
  const [assignmentSubject, setAssignmentSubject] = useState("");
  const [assignmentDifficulty, setAssignmentDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [assignmentRubric, setAssignmentRubric] = useState("");
  const [assignmentText, setAssignmentText] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");

  async function importAssignment() {
    if (!assignmentText.trim()) return;
    setError(null);
    setImporting(true);
    try {
      await handleParsed({
        kind: "assignment",
        title:
          assignmentTitle.trim() ||
          `${t.sources.assignmentTitle}: ${assignmentText
            .trim()
            .slice(0, 40)}...`,
        content: assignmentText.trim(),
        mime: "text/plain",
        assignment: {
          subject: assignmentSubject.trim() || undefined,
          difficulty: assignmentDifficulty,
          rubric: assignmentRubric.trim() || undefined,
        },
      });
      onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{t.sources.addDialogTitle}</h3>
            <p className="text-sky-600 text-lg">{t.sources.addDialogSubtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
          >
            <I.X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 border border-zinc-200 rounded-xl p-4">
          <div className="text-center text-zinc-700 text-sm">
            <p className="font-medium">{t.sources.dropHere}</p>
            <p className="text-xs text-zinc-500">{t.sources.dropTypes}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              className={`btn ${tab === "files" ? "btn-primary" : ""}`}
              onClick={() => setTab("files")}
            >
              <I.Upload className="w-4 h-4" /> {t.sources.uploadFiles}
            </button>
            <button
              className={`btn ${tab === "url" ? "btn-primary" : ""}`}
              onClick={() => setTab("url")}
            >
              <I.Link2 className="w-4 h-4" /> {t.sources.website}
            </button>
            <button
              className={`btn ${tab === "paste" ? "btn-primary" : ""}`}
              onClick={() => setTab("paste")}
            >
              <I.FileText className="w-4 h-4" /> {t.sources.pastedText}
            </button>
            <button
              className={`btn ${tab === "assignment" ? "btn-primary" : ""}`}
              onClick={() => setTab("assignment")}
            >
              <I.BookOpen className="w-4 h-4" /> {t.sources.assignment}
            </button>
          </div>

          {tab === "files" && (
            <div className="mt-4 space-y-2">
              <input
                ref={fileInput}
                type="file"
                multiple
                onChange={(e) => uploadFiles(e.target.files)}
                accept=".pdf,.txt,.md,.markdown,.csv,.docx,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.heic,.heif,.avif,image/*"
                className="block w-full text-sm cursor-pointer"
              />
              <p className="text-xs text-zinc-500">
                Қолдау көрсетіледі: PDF, DOCX, PPTX, TXT, MD, CSV, суреттер
              </p>
            </div>
          )}

          {tab === "url" && (
            <div className="mt-4 space-y-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.sources.pasteUrl}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <p className="text-xs text-zinc-500">{t.sources.pasteUrlHelp}</p>
              <button
                disabled={importing || !url.trim()}
                onClick={importUrl}
                className="btn btn-primary disabled:opacity-50"
              >
                {importing ? <I.Loader2 className="w-4 h-4 animate-spin" /> : <I.Plus className="w-4 h-4" />}
                {t.sources.add_}
              </button>
            </div>
          )}

          {tab === "assignment" && (
            <div className="mt-4 space-y-2">
              <input
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                placeholder="Атау"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={assignmentSubject}
                  onChange={(e) => setAssignmentSubject(e.target.value)}
                  placeholder={t.sources.assignmentSubjectPh}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <select
                  value={assignmentDifficulty}
                  onChange={(e) =>
                    setAssignmentDifficulty(
                      e.target.value as "easy" | "medium" | "hard",
                    )
                  }
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white cursor-pointer"
                >
                  <option value="easy">{t.studio.easy}</option>
                  <option value="medium">{t.studio.medium}</option>
                  <option value="hard">{t.studio.hard}</option>
                </select>
              </div>
              <textarea
                value={assignmentText}
                onChange={(e) => setAssignmentText(e.target.value)}
                placeholder={t.sources.assignmentTextPh}
                rows={6}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
              />
              <textarea
                value={assignmentRubric}
                onChange={(e) => setAssignmentRubric(e.target.value)}
                placeholder={t.sources.assignmentRubricPh}
                rows={3}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                disabled={importing || !assignmentText.trim()}
                onClick={importAssignment}
                className="btn btn-primary disabled:opacity-50"
              >
                {importing ? (
                  <I.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <I.Plus className="w-4 h-4" />
                )}
                {t.sources.add_}
              </button>
            </div>
          )}

          {tab === "paste" && (
            <div className="mt-4 space-y-2">
              <input
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Атау"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.sources.pasteText}
                rows={8}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
              />
              <button
                disabled={importing || !text.trim()}
                onClick={importText}
                className="btn btn-primary disabled:opacity-50"
              >
                {importing ? <I.Loader2 className="w-4 h-4 animate-spin" /> : <I.Plus className="w-4 h-4" />}
                {t.sources.add_}
              </button>
            </div>
          )}

          {importing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
              <I.Loader2 className="w-4 h-4 animate-spin" /> {t.sources.importing}
            </div>
          )}
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}
