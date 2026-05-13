"use client";
import { useMemo, useState } from "react";
import type { StudioArtifact } from "@/lib/types";
import { I } from "../../Icon";
import { t } from "@/lib/i18n";

interface Q {
  q: string;
  choices: string[];
  answer: number;
  explain?: string;
  hint?: string;
}

function parseQ(raw: string): Q[] {
  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && Array.isArray(x.choices) && typeof x.q === "string" && typeof x.answer === "number")
      .map((x) => ({
        q: String(x.q),
        choices: x.choices.map((c: unknown) => String(c)),
        answer: Number(x.answer),
        explain: x.explain ? String(x.explain) : undefined,
        hint: x.hint ? String(x.hint) : undefined,
      }));
  } catch {
    return [];
  }
}

export function QuizView({ artifact }: { artifact: StudioArtifact }) {
  const questions = useMemo(() => parseQ(artifact.body), [artifact.body]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [showHint, setShowHint] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="p-6 text-sm">
        Тестті талдау мүмкін болмады.
        <pre className="mt-3 text-xs whitespace-pre-wrap">{artifact.body}</pre>
      </div>
    );
  }
  const cur = questions[idx];
  const correctCount = Object.entries(picked).filter(
    ([i, v]) => questions[Number(i)] && questions[Number(i)].answer === v,
  ).length;

  if (done) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-xl font-semibold">Нәтиже</h3>
        <p className="text-sm text-zinc-600">
          {correctCount} / {questions.length} дұрыс
        </p>
        <button
          onClick={() => {
            setPicked({});
            setIdx(0);
            setDone(false);
            setShowAnswer(false);
            setShowHint(false);
          }}
          className="btn btn-primary"
        >
          <I.RotateCcw className="w-4 h-4" /> {t.studio.practiceAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
        <span>{t.studio.progress(idx + 1, questions.length)}</span>
        <div className="flex gap-2">
          {cur.hint && (
            <button onClick={() => setShowHint(!showHint)} className="btn text-xs">
              <I.Lightbulb className="w-3.5 h-3.5" /> {t.studio.hint}
            </button>
          )}
          <button onClick={() => setShowAnswer(!showAnswer)} className="btn text-xs">
            <I.Eye className="w-3.5 h-3.5" /> {t.studio.showAnswer}
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 p-6 bg-zinc-50">
        <p className="text-base font-medium mb-4">{cur.q}</p>
        <div className="space-y-2">
          {cur.choices.map((c, i) => {
            const isPicked = picked[idx] === i;
            const isCorrect = i === cur.answer;
            const showFeedback = showAnswer || picked[idx] !== undefined;
            return (
              <button
                key={i}
                onClick={() => setPicked({ ...picked, [idx]: i })}
                className={`w-full text-left rounded-xl px-4 py-2 border cursor-pointer ${
                  showFeedback && isCorrect
                    ? "bg-emerald-50 border-emerald-400"
                    : showFeedback && isPicked && !isCorrect
                    ? "bg-rose-50 border-rose-400"
                    : isPicked
                    ? "bg-white border-blue-400"
                    : "bg-white hover:bg-zinc-100 border-zinc-200"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        {showHint && cur.hint && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            💡 {cur.hint}
          </div>
        )}
        {(showAnswer || picked[idx] !== undefined) && cur.explain && (
          <div className="mt-3 text-sm text-zinc-700 bg-white border border-zinc-200 rounded p-2">
            <strong>{t.studio.explain}:</strong> {cur.explain}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => {
            setIdx(Math.max(0, idx - 1));
            setShowAnswer(false);
            setShowHint(false);
          }}
          disabled={idx === 0}
          className="btn text-xs"
        >
          <I.ChevronLeft className="w-3.5 h-3.5" /> {t.studio.previous}
        </button>
        {idx === questions.length - 1 ? (
          <button onClick={() => setDone(true)} className="btn btn-primary">
            {t.common.confirm}
          </button>
        ) : (
          <button
            onClick={() => {
              setIdx(idx + 1);
              setShowAnswer(false);
              setShowHint(false);
            }}
            className="btn text-xs"
          >
            {t.studio.next} <I.ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
