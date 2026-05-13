"use client";
import { useState, useMemo } from "react";
import type { StudioArtifact, Source } from "@/lib/types";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "../../Icon";
import { Markdown } from "../../Markdown";

interface PracticeBody {
  assignmentSourceId: string;
  solution: string;
}

function parseBody(raw: string): PracticeBody | null {
  try {
    const j = JSON.parse(raw);
    if (typeof j.solution === "string") return j as PracticeBody;
    return null;
  } catch {
    return null;
  }
}

export function PracticeView({ artifact }: { artifact: StudioArtifact }) {
  const sources = useApp((s) => s.sources);
  const updateArtifact = useApp((s) => s.updateArtifact);

  const parsed = useMemo(() => parseBody(artifact.body), [artifact.body]);
  const assignment: Source | undefined = useMemo(
    () => sources.find((s) => s.id === parsed?.assignmentSourceId),
    [sources, parsed?.assignmentSourceId],
  );

  const [tab, setTab] = useState<"solve" | "practice">("solve");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState<"none" | "grade" | "hint" | "solve">(
    "none",
  );
  const [error, setError] = useState<string | null>(null);

  const solution = parsed?.solution ?? "";

  async function regenerateSolution() {
    if (!assignment) return;
    setLoading("solve");
    setError(null);
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "solve", assignmentSource: assignment }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "solve failed");
      const newBody: PracticeBody = {
        assignmentSourceId: assignment.id,
        solution: j.content,
      };
      await updateArtifact(artifact.id, { body: JSON.stringify(newBody) });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading("none");
    }
  }

  async function grade() {
    if (!assignment || !studentAnswer.trim()) return;
    setLoading("grade");
    setError(null);
    setFeedback("");
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "grade",
          assignmentSource: assignment,
          studentAnswer: studentAnswer.trim(),
          spec: { ...assignment.assignment, solution },
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "grade failed");
      setFeedback(j.content);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading("none");
    }
  }

  async function askHint() {
    if (!assignment) return;
    setLoading("hint");
    setError(null);
    try {
      const r = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "hint", assignmentSource: assignment }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "hint failed");
      setHint(j.content);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading("none");
    }
  }

  return (
    <div className="p-6">
      {assignment && (
        <div className="mb-4 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
          <div className="text-xs text-zinc-500 mb-1">
            {t.sources.assignmentTitle} ·{" "}
            {assignment.assignment?.subject || "—"} ·{" "}
            {assignment.assignment?.difficulty || "—"}
          </div>
          <div className="font-medium whitespace-pre-wrap text-sm">
            {assignment.content.slice(0, 800)}
            {assignment.content.length > 800 ? "..." : ""}
          </div>
        </div>
      )}

      <div className="inline-flex rounded-full bg-zinc-100 p-0.5 mb-4">
        <button
          onClick={() => setTab("solve")}
          className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
            tab === "solve" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          {t.studio.practiceShowSolution}
        </button>
        <button
          onClick={() => setTab("practice")}
          className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
            tab === "practice" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          {t.studio.practice}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {tab === "solve" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">{t.studio.practiceSolution}</h3>
            <button
              onClick={regenerateSolution}
              disabled={loading === "solve"}
              className="btn text-xs"
            >
              {loading === "solve" ? (
                <I.Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <I.RefreshCcw className="w-3.5 h-3.5" />
              )}
              {t.studio.regenerate}
            </button>
          </div>
          <article className="prose-sm">
            <Markdown>{solution || t.studio.generating}</Markdown>
          </article>
        </div>
      )}

      {tab === "practice" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              {t.studio.practiceMyAnswer}
            </label>
            <textarea
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              placeholder={t.studio.practiceMyAnswerPh}
              rows={8}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={grade}
              disabled={loading !== "none" || !studentAnswer.trim()}
              className="btn btn-primary"
            >
              {loading === "grade" ? (
                <I.Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <I.CheckCircle2 className="w-4 h-4" />
              )}
              {t.studio.practiceCheck}
            </button>
            <button
              onClick={askHint}
              disabled={loading !== "none"}
              className="btn"
            >
              {loading === "hint" ? (
                <I.Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <I.Lightbulb className="w-4 h-4" />
              )}
              {t.studio.practiceGetHint}
            </button>
          </div>
          {hint && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-semibold text-amber-700 mb-1">
                {t.studio.hint}
              </div>
              <Markdown>{hint}</Markdown>
            </div>
          )}
          {feedback && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-semibold text-emerald-700 mb-1">
                {t.studio.practiceFeedback}
              </div>
              <Markdown>{feedback}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
