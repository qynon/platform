"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { t } from "@/lib/i18n";
import { I } from "./Icon";
import { Markdown } from "./Markdown";
import type { ChatMessage, Citation, Source } from "@/lib/types";
import type { AgentModel, AgentToolType } from "@/lib/agent";

type ChatMode = "chat" | "agent";

const AGENT_MODELS: { id: AgentModel; label: string }[] = [
  { id: "openai/gpt-5.4", label: "OpenAI · GPT-5.4" },
  { id: "openai/gpt-5.1", label: "OpenAI · GPT-5.1" },
  { id: "anthropic/claude-opus-4.1", label: "Anthropic · Claude Opus 4.1" },
  { id: "anthropic/claude-sonnet-4.5", label: "Anthropic · Claude Sonnet 4.5" },
  { id: "google/gemini-2.5-pro", label: "Google · Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Google · Gemini 2.5 Flash" },
  { id: "xai/grok-4", label: "xAI · Grok 4" },
  { id: "perplexity/sonar-pro", label: "Perplexity · Sonar Pro" },
  { id: "perplexity/sonar-reasoning", label: "Perplexity · Sonar Reasoning" },
];

function CitationChip({
  c,
  onClick,
}: {
  c: Citation;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="citation-chip"
      title={c.snippet}
      data-cite={c.index}
    >
      {c.index}
    </button>
  );
}

function renderWithCitations(content: string, citations: Citation[], onOpen: (c: Citation) => void) {
  // We render markdown, but post-process by replacing [N] with custom buttons.
  // Simpler approach: split content by [N] markers and interleave.
  const parts: Array<{ type: "text" | "cite"; value: string | number }> = [];
  let last = 0;
  const re = /\[(\d{1,2})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ type: "text", value: content.slice(last, m.index) });
    parts.push({ type: "cite", value: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) });

  return (
    <div className="markdown-body">
      {parts.map((p, i) =>
        p.type === "text" ? (
          <Markdown key={i}>{p.value as string}</Markdown>
        ) : (
          (() => {
            const cite = citations.find((c) => c.index === p.value);
            if (!cite) return <span key={i}>[{p.value}]</span>;
            return <CitationChip key={i} c={cite} onClick={() => onOpen(cite)} />;
          })()
        ),
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  sources,
  onOpenCite,
  onSaveAsNote,
}: {
  msg: ChatMessage;
  sources: Source[];
  onOpenCite: (c: Citation) => void;
  onSaveAsNote: () => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`px-2 py-3 ${isUser ? "" : "bg-white rounded-2xl border border-zinc-200 my-1 p-4 shadow-sm"}`}>
      {isUser ? (
        <div className="flex justify-end">
          <div className="bg-blue-50 text-blue-900 px-4 py-2 rounded-2xl rounded-br-md max-w-[80%] whitespace-pre-wrap text-sm">
            {msg.content}
          </div>
        </div>
      ) : (
        <>
          {renderWithCitations(msg.content, msg.citations ?? [], onOpenCite)}
          {msg.citations && msg.citations.length > 0 && (
            <div className="mt-3 border-t pt-2 text-xs text-zinc-600 space-y-1">
              <div className="font-semibold text-zinc-800">{t.chat.citationsHeading}</div>
              {msg.citations.map((c) => {
                const src = sources.find((s) => s.id === c.sourceId);
                return (
                  <div key={c.index} className="flex gap-2">
                    <button className="citation-chip" onClick={() => onOpenCite(c)}>
                      {c.index}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{src?.title || "?"}</div>
                      <div className="text-zinc-500 line-clamp-2">{c.snippet}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button onClick={onSaveAsNote} className="text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer flex items-center gap-1">
              <I.StickyNote className="w-3.5 h-3.5" /> {t.chat.saveToNote}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CitationDrawer({
  cite,
  onClose,
}: {
  cite: { source: Source; offset: number } | null;
  onClose: () => void;
}) {
  if (!cite) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">{t.chat.citationsHeading}</div>
            <div className="font-semibold truncate">{cite.source.title}</div>
            {cite.source.url && (
              <a
                href={cite.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate block"
              >
                {cite.source.url}
              </a>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer">
            <I.X className="w-5 h-5" />
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 font-sans">
          {cite.source.content}
        </pre>
      </div>
    </div>
  );
}

export function ChatPanel() {
  const messages = useApp((s) => s.messages);
  const sources = useApp((s) => s.sources);
  const addMessage = useApp((s) => s.addMessage);
  const addNote = useApp((s) => s.addNote);
  const chatStyle = useApp((s) => s.chatStyle);
  const setChatStyle = useApp((s) => s.setChatStyle);
  const isChatLoading = useApp((s) => s.isChatLoading);
  const setChatLoading = useApp((s) => s.setChatLoading);
  const clearMessages = useApp((s) => s.clearMessages);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openCite, setOpenCite] = useState<{ source: Source; offset: number } | null>(null);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [agentModel, setAgentModel] = useState<AgentModel>("openai/gpt-5.4");
  const [agentTools, setAgentTools] = useState<Record<AgentToolType, boolean>>({
    web_search: true,
    fetch_url: true,
    finance_search: false,
    people_search: false,
  });
  const [lastUsage, setLastUsage] = useState<{
    tokens?: number;
    cost?: number;
  } | null>(null);

  const enabledCount = sources.filter((s) => s.enabled).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages.length]);

  async function send(text: string) {
    if (!text.trim() || isChatLoading) return;
    await addMessage({
      role: "user",
      content: text.trim(),
      notebookId: useApp.getState().currentNotebookId ?? "",
      style: chatStyle,
    });
    setInput("");
    setChatLoading(true);
    try {
      if (mode === "agent") {
        const tools = (Object.entries(agentTools) as [AgentToolType, boolean][])
          .filter(([, on]) => on)
          .map(([type]) => ({ type }));
        const r = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources,
            question: text.trim(),
            model: agentModel,
            tools,
          }),
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "agent failed");
        if (j.usage) {
          setLastUsage({
            tokens: j.usage.total_tokens,
            cost: j.usage.cost?.total_cost,
          });
        }
        await addMessage({
          role: "assistant",
          content: j.content,
          notebookId: useApp.getState().currentNotebookId ?? "",
          style: chatStyle,
        });
      } else {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sources,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            style: chatStyle,
            question: text.trim(),
          }),
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "chat failed");
        await addMessage({
          role: "assistant",
          content: j.content,
          citations: j.citations,
          notebookId: useApp.getState().currentNotebookId ?? "",
          style: chatStyle,
        });
      }
    } catch (e) {
      await addMessage({
        role: "assistant",
        content: `(Қате: ${String(e instanceof Error ? e.message : e)})`,
        notebookId: useApp.getState().currentNotebookId ?? "",
        style: chatStyle,
      });
    } finally {
      setChatLoading(false);
    }
  }

  const suggestedPrompts = useMemo(
    () => [
      "Дереккөздердің негізгі идеяларын қорытындылаңыз",
      "Маңызды деректерді кесте түрінде шығарыңыз",
      "Әр дереккөзден 3 негізгі тұжырымды атаңыз",
    ],
    [],
  );

  return (
    <main className="flex-1 bg-white rounded-2xl m-2 mx-1 flex flex-col border border-border min-h-0">
      <div className="px-4 py-2 border-b flex items-center justify-between text-sm gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-semibold">{t.chat.title}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex rounded-full bg-zinc-100 p-0.5">
            <button
              onClick={() => setMode("chat")}
              className={`text-xs px-2.5 py-0.5 rounded-full cursor-pointer flex items-center gap-1 ${
                mode === "chat" ? "bg-white shadow-sm" : "text-zinc-500"
              }`}
              title={t.chat_agent.chatMode}
            >
              <I.Sparkles className="w-3 h-3" /> {t.chat_agent.chatMode}
            </button>
            <button
              onClick={() => setMode("agent")}
              className={`text-xs px-2.5 py-0.5 rounded-full cursor-pointer flex items-center gap-1 ${
                mode === "agent" ? "bg-white shadow-sm" : "text-zinc-500"
              }`}
              title={t.chat_agent.agentDesc}
            >
              <I.Wand2 className="w-3 h-3" /> {t.chat_agent.agentMode}
            </button>
          </div>
          {mode === "agent" && (
            <>
              <select
                className="text-xs border border-zinc-200 rounded-full px-2 py-1 outline-none cursor-pointer max-w-[180px]"
                value={agentModel}
                onChange={(e) => setAgentModel(e.target.value as AgentModel)}
                title={t.chat_agent.selectModel}
              >
                {AGENT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <details className="relative">
                <summary className="text-xs border border-zinc-200 rounded-full px-2 py-1 cursor-pointer list-none flex items-center gap-1">
                  <I.Hash className="w-3 h-3" /> {t.chat_agent.enableTools}
                  <span className="text-zinc-500">
                    ({Object.values(agentTools).filter(Boolean).length})
                  </span>
                </summary>
                <div className="absolute right-0 mt-1 z-30 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 min-w-[200px] space-y-1">
                  {(
                    [
                      ["web_search", t.chat_agent.toolWebSearch],
                      ["fetch_url", t.chat_agent.toolFetchUrl],
                      ["finance_search", t.chat_agent.toolFinanceSearch],
                      ["people_search", t.chat_agent.toolPeopleSearch],
                    ] as Array<[AgentToolType, string]>
                  ).map(([k, label]) => (
                    <label
                      key={k}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-zinc-50 px-2 py-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={agentTools[k]}
                        onChange={(e) =>
                          setAgentTools((s) => ({ ...s, [k]: e.target.checked }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </details>
            </>
          )}
          <select
            className="text-xs border border-zinc-200 rounded-full px-2 py-1 outline-none cursor-pointer"
            value={chatStyle}
            onChange={(e) =>
              setChatStyle(e.target.value as "default" | "learning-guide")
            }
            title={t.chat.style}
          >
            <option value="default">{t.chat.styleDefault}</option>
            <option value="learning-guide">{t.chat.styleLearning}</option>
          </select>
          {messages.length > 0 && (
            <button
              onClick={() => clearMessages()}
              className="p-1.5 rounded-full hover:bg-zinc-100 cursor-pointer"
              title={t.common.close}
            >
              <I.RefreshCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {lastUsage && (
        <div className="px-4 py-1 text-[11px] text-zinc-500 border-b">
          {t.chat_agent.tokens}: {lastUsage.tokens ?? "—"} ·{" "}
          {t.chat_agent.cost}:{" "}
          {lastUsage.cost !== undefined
            ? `$${lastUsage.cost.toFixed(4)}`
            : "—"}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto pt-10 space-y-4">
            <div className="text-4xl">👋</div>
            <h2 className="text-2xl font-semibold">{t.chat.welcomeTitle}</h2>
            <p className="text-zinc-600 leading-relaxed">{t.chat.welcomeBody}</p>
            <p className="text-zinc-700 font-medium pt-2">{t.chat.welcomeAsk}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => send(t.chat.suggestions.start)}>{t.chat.suggestions.start}</button>
              <button className="btn" onClick={() => send(t.chat.suggestions.learn)}>{t.chat.suggestions.learn}</button>
              <button className="btn" onClick={() => send(t.chat.suggestions.generate)}>{t.chat.suggestions.generate}</button>
              <button className="btn" onClick={() => send(t.chat.suggestions.other)}>{t.chat.suggestions.other}</button>
            </div>
            {enabledCount > 0 && (
              <div className="pt-6 space-y-2">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  {t.chat.suggestedPrompts}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((p) => (
                    <button key={p} className="btn" onClick={() => send(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              sources={sources}
              onOpenCite={(c) => {
                const s = sources.find((x) => x.id === c.sourceId);
                if (s) setOpenCite({ source: s, offset: c.offset ?? 0 });
              }}
              onSaveAsNote={() => {
                addNote({
                  notebookId: useApp.getState().currentNotebookId ?? "",
                  title: m.content.slice(0, 60),
                  content: m.content,
                  fromChat: true,
                  pinned: false,
                });
              }}
            />
          ))
        )}
        {isChatLoading && (
          <div className="text-sm text-zinc-500 flex items-center gap-2 px-2 py-3">
            <I.Loader2 className="w-4 h-4 animate-spin" /> {t.chat.thinking}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-2">
        {enabledCount === 0 && sources.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
            {t.chat.noSourcesWarning}
          </div>
        )}
        <div className="flex items-end gap-2 border border-zinc-200 rounded-2xl px-3 py-2 bg-white shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chat.placeholder}
            rows={1}
            className="flex-1 resize-none outline-none text-sm py-1 leading-6 max-h-40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <span className="text-xs text-zinc-500 self-center">
            {t.chat.sourcesCount(enabledCount)}
          </span>
          <button
            disabled={isChatLoading || !input.trim()}
            onClick={() => send(input)}
            className="p-2 rounded-full bg-zinc-900 text-white disabled:opacity-40 cursor-pointer"
          >
            <I.Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CitationDrawer cite={openCite} onClose={() => setOpenCite(null)} />
    </main>
  );
}
