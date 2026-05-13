"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { I } from "../Icon";
import type { StudioArtifactKind } from "@/lib/types";

export function CustomizeDialog({
  kind,
  onClose,
  onGenerate,
}: {
  kind: StudioArtifactKind;
  onClose: () => void;
  onGenerate: (
    opts: Record<string, string | number | boolean>,
    customPrompt: string,
  ) => void;
}) {
  const [opts, setOpts] = useState<Record<string, string | number | boolean>>(defaultOpts(kind));
  const [customPrompt, setCustomPrompt] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{t.studio.customize}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer">
            <I.X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm">{renderOptions(kind, opts, setOpts)}</div>
        <label className="block mt-3 text-xs text-zinc-600">{t.studio.promptLabel}</label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={t.studio.promptPlaceholder}
          rows={3}
          className="w-full border border-zinc-200 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn">
            {t.common.cancel}
          </button>
          <button
            onClick={() => onGenerate(opts, customPrompt)}
            className="btn btn-primary"
          >
            <I.Wand2 className="w-4 h-4" /> {t.studio.generate}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultOpts(kind: StudioArtifactKind): Record<string, string | number | boolean> {
  switch (kind) {
    case "audio-overview":
      return { format: "deep-dive", length: "default", language: "kk" };
    case "video-overview":
      return { format: "explainer", visualStyle: "auto", language: "kk" };
    case "flashcards":
    case "quiz":
      return { difficulty: "medium", quantity: "standard" };
    case "slides":
      return { format: "detailed", length: "default", language: "kk" };
    case "infographic":
      return { detail: "standard", orientation: "portrait", visualStyle: "professional", language: "kk" };
    case "report":
      return { type: "custom" };
    case "data-table":
      return { language: "kk" };
    default:
      return {};
  }
}

function renderOptions(
  kind: StudioArtifactKind,
  opts: Record<string, string | number | boolean>,
  set: (next: Record<string, string | number | boolean>) => void,
) {
  const setKey = (k: string, v: string | number | boolean) => set({ ...opts, [k]: v });

  const Group = ({
    label,
    name,
    options,
  }: {
    label: string;
    name: string;
    options: Array<[string, string]>;
  }) => (
    <div>
      <div className="text-xs text-zinc-600 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setKey(name, v)}
            className={`text-xs px-3 py-1 rounded-full border cursor-pointer ${
              String(opts[name]) === v
                ? "bg-zinc-900 text-white border-zinc-900"
                : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  switch (kind) {
    case "audio-overview":
      return (
        <>
          <Group
            label={t.studio.style}
            name="format"
            options={[
              ["deep-dive", t.studio.deepDive],
              ["brief", t.studio.brief],
              ["critique", t.studio.critique],
              ["debate", t.studio.debate],
            ]}
          />
          <Group
            label={t.studio.length}
            name="length"
            options={[
              ["short", t.studio.short],
              ["default", t.studio.standard],
              ["long", t.studio.long],
            ]}
          />
        </>
      );
    case "video-overview":
      return (
        <>
          <Group
            label={t.studio.style}
            name="format"
            options={[
              ["cinematic", `${t.studio.cinematic} (${t.studio.cinematicWarning})`],
              ["explainer", t.studio.explainer],
              ["brief", t.studio.brief],
            ]}
          />
          <Group
            label={t.studio.visualStyle}
            name="visualStyle"
            options={[
              ["auto", t.studio.autoSelect],
              ["classic", "Classic"],
              ["whiteboard", "Whiteboard"],
              ["watercolor", "Watercolor"],
              ["retro-print", "Retro Print"],
              ["heritage", "Heritage"],
              ["paper-craft", "Paper-craft"],
              ["kawaii", "Kawaii"],
              ["anime", "Anime"],
            ]}
          />
        </>
      );
    case "flashcards":
    case "quiz":
      return (
        <>
          <Group
            label={t.studio.difficulty}
            name="difficulty"
            options={[
              ["easy", t.studio.easy],
              ["medium", t.studio.medium],
              ["hard", t.studio.hard],
            ]}
          />
          <Group
            label={t.studio.quantity}
            name="quantity"
            options={[
              ["fewer", t.studio.fewer],
              ["standard", t.studio.standard],
              ["more", t.studio.more],
            ]}
          />
        </>
      );
    case "slides":
      return (
        <>
          <Group
            label={t.studio.style}
            name="format"
            options={[
              ["detailed", t.studio.detailedDeck],
              ["presenter", t.studio.presenterSlides],
            ]}
          />
          <Group
            label={t.studio.length}
            name="length"
            options={[
              ["short", t.studio.short],
              ["default", t.studio.standard],
              ["long", t.studio.long],
            ]}
          />
        </>
      );
    case "infographic":
      return (
        <>
          <Group
            label={t.studio.orientation}
            name="orientation"
            options={[
              ["square", t.studio.square],
              ["portrait", t.studio.portrait],
              ["landscape", t.studio.landscape],
            ]}
          />
          <Group
            label={t.studio.detail}
            name="detail"
            options={[
              ["concise", t.studio.concise],
              ["standard", t.studio.standard],
              ["detailed", t.studio.detailed],
            ]}
          />
          <Group
            label={t.studio.visualStyle}
            name="visualStyle"
            options={[
              ["auto", t.studio.autoSelect],
              ["sketch", "Sketch Note"],
              ["kawaii", "Kawaii"],
              ["professional", "Professional"],
            ]}
          />
        </>
      );
    case "report":
      return (
        <Group
          label={t.studio.style}
          name="type"
          options={[
            ["custom", t.studio.customReport],
            ["faq", t.studio.faq],
            ["study-guide", t.studio.studyGuide],
            ["briefing", t.studio.briefingDoc],
            ["ai-suggested", t.studio.aiSuggested],
          ]}
        />
      );
    default:
      return <div className="text-xs text-zinc-500">Қосымша параметрлер жоқ.</div>;
  }
}
