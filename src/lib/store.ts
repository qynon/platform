"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import {
  artifactsStore,
  deleteNotebook as dbDeleteNotebook,
  getNotebook,
  listNotebooks,
  messagesStore,
  notesStore,
  saveNotebook,
  sourcesStore,
} from "./db";
import { pickEmoji } from "./emoji";
import type {
  ChatMessage,
  ConversationalStyle,
  Note,
  Notebook,
  Source,
  StudioArtifact,
} from "./types";
import { t as strings } from "./i18n";

interface AppState {
  hydrated: boolean;
  notebooks: Notebook[];
  currentNotebookId: string | null;
  sources: Source[];
  messages: ChatMessage[];
  notes: Note[];
  artifacts: StudioArtifact[];
  chatStyle: ConversationalStyle;
  isChatLoading: boolean;
  isDeepResearchRunning: boolean;

  init: () => Promise<void>;
  createNotebook: (title?: string) => Promise<Notebook>;
  selectNotebook: (id: string | null) => Promise<void>;
  renameNotebook: (id: string, title: string) => Promise<void>;
  setNotebookEmoji: (id: string, emoji: string, pinned?: boolean) => Promise<void>;
  removeNotebook: (id: string) => Promise<void>;

  addSource: (src: Omit<Source, "id" | "createdAt" | "enabled">) => Promise<Source>;
  updateSource: (id: string, patch: Partial<Source>) => Promise<void>;
  toggleSource: (id: string, enabled: boolean) => Promise<void>;
  toggleAllSources: (enabled: boolean) => Promise<void>;
  removeSource: (id: string) => Promise<void>;

  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => Promise<ChatMessage>;
  clearMessages: () => Promise<void>;
  setChatStyle: (s: ConversationalStyle) => void;
  setChatLoading: (v: boolean) => void;
  setDeepResearchRunning: (v: boolean) => void;

  addNote: (n: Omit<Note, "id" | "createdAt">) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  addArtifact: (a: Omit<StudioArtifact, "id" | "createdAt">) => Promise<StudioArtifact>;
  updateArtifact: (id: string, patch: Partial<StudioArtifact>) => Promise<void>;
  removeArtifact: (id: string) => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  notebooks: [],
  currentNotebookId: null,
  sources: [],
  messages: [],
  notes: [],
  artifacts: [],
  chatStyle: "default",
  isChatLoading: false,
  isDeepResearchRunning: false,

  async init() {
    if (get().hydrated) return;
    const notebooks = await listNotebooks();
    set({ notebooks, hydrated: true });
  },

  async createNotebook(title) {
    const id = nanoid();
    const realTitle = (title?.trim() || strings.app.untitled);
    const nb: Notebook = {
      id,
      title: realTitle,
      emoji: pickEmoji(realTitle),
      emojiPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveNotebook(nb);
    set((s) => ({ notebooks: [nb, ...s.notebooks] }));
    return nb;
  },

  async selectNotebook(id) {
    if (id === null) {
      set({
        currentNotebookId: null,
        sources: [],
        messages: [],
        notes: [],
        artifacts: [],
      });
      return;
    }
    const [sources, messages, notes, artifacts] = await Promise.all([
      sourcesStore.list(id),
      messagesStore.list(id),
      notesStore.list(id),
      artifactsStore.list(id),
    ]);
    set({
      currentNotebookId: id,
      sources,
      messages,
      notes,
      artifacts,
    });
  },

  async renameNotebook(id, title) {
    const nb = await getNotebook(id);
    if (!nb) return;
    const next = { ...nb, title, updatedAt: Date.now() };
    if (!nb.emojiPinned) next.emoji = pickEmoji(title);
    await saveNotebook(next);
    set((s) => ({
      notebooks: s.notebooks.map((x) => (x.id === id ? next : x)),
    }));
  },

  async setNotebookEmoji(id, emoji, pinned = true) {
    const nb = await getNotebook(id);
    if (!nb) return;
    const next: Notebook = { ...nb, emoji, emojiPinned: pinned, updatedAt: Date.now() };
    await saveNotebook(next);
    set((s) => ({
      notebooks: s.notebooks.map((x) => (x.id === id ? next : x)),
    }));
  },

  async removeNotebook(id) {
    await dbDeleteNotebook(id);
    set((s) => ({
      notebooks: s.notebooks.filter((x) => x.id !== id),
      currentNotebookId: s.currentNotebookId === id ? null : s.currentNotebookId,
      sources: s.currentNotebookId === id ? [] : s.sources,
      messages: s.currentNotebookId === id ? [] : s.messages,
      notes: s.currentNotebookId === id ? [] : s.notes,
      artifacts: s.currentNotebookId === id ? [] : s.artifacts,
    }));
  },

  async addSource(src) {
    const nid = get().currentNotebookId;
    if (!nid) throw new Error("No notebook selected");
    const newSrc: Source = {
      ...src,
      id: nanoid(),
      createdAt: Date.now(),
      enabled: true,
    };
    const next = [...get().sources, newSrc];
    set({ sources: next });
    await sourcesStore.save(nid, next);
    await touchNotebook(nid);
    return newSrc;
  },

  async updateSource(id, patch) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().sources.map((s) =>
      s.id === id ? { ...s, ...patch } : s,
    );
    set({ sources: next });
    await sourcesStore.save(nid, next);
  },

  async toggleSource(id, enabled) {
    await get().updateSource(id, { enabled });
  },

  async toggleAllSources(enabled) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().sources.map((s) => ({ ...s, enabled }));
    set({ sources: next });
    await sourcesStore.save(nid, next);
  },

  async removeSource(id) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().sources.filter((s) => s.id !== id);
    set({ sources: next });
    await sourcesStore.save(nid, next);
  },

  async addMessage(msg) {
    const nid = get().currentNotebookId;
    if (!nid) throw new Error("No notebook selected");
    const m: ChatMessage = { ...msg, id: nanoid(), createdAt: Date.now() };
    const next = [...get().messages, m];
    set({ messages: next });
    await messagesStore.save(nid, next);
    return m;
  },

  async clearMessages() {
    const nid = get().currentNotebookId;
    if (!nid) return;
    set({ messages: [] });
    await messagesStore.save(nid, []);
  },

  setChatStyle(s) {
    set({ chatStyle: s });
  },

  setChatLoading(v) {
    set({ isChatLoading: v });
  },

  setDeepResearchRunning(v) {
    set({ isDeepResearchRunning: v });
  },

  async addNote(n) {
    const nid = get().currentNotebookId;
    if (!nid) throw new Error("No notebook selected");
    const note: Note = { ...n, id: nanoid(), createdAt: Date.now() };
    const next = [note, ...get().notes];
    set({ notes: next });
    await notesStore.save(nid, next);
    return note;
  },

  async updateNote(id, patch) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().notes.map((n) =>
      n.id === id ? { ...n, ...patch } : n,
    );
    set({ notes: next });
    await notesStore.save(nid, next);
  },

  async removeNote(id) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().notes.filter((n) => n.id !== id);
    set({ notes: next });
    await notesStore.save(nid, next);
  },

  async addArtifact(a) {
    const nid = get().currentNotebookId;
    if (!nid) throw new Error("No notebook selected");
    const art: StudioArtifact = { ...a, id: nanoid(), createdAt: Date.now() };
    const next = [art, ...get().artifacts];
    set({ artifacts: next });
    await artifactsStore.save(nid, next);
    return art;
  },

  async updateArtifact(id, patch) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().artifacts.map((a) =>
      a.id === id ? { ...a, ...patch } : a,
    );
    set({ artifacts: next });
    await artifactsStore.save(nid, next);
  },

  async removeArtifact(id) {
    const nid = get().currentNotebookId;
    if (!nid) return;
    const next = get().artifacts.filter((a) => a.id !== id);
    set({ artifacts: next });
    await artifactsStore.save(nid, next);
  },
}));

async function touchNotebook(id: string) {
  const nb = await getNotebook(id);
  if (!nb) return;
  const next = { ...nb, updatedAt: Date.now() };
  await saveNotebook(next);
  useApp.setState((s) => ({
    notebooks: s.notebooks
      .map((x) => (x.id === id ? next : x))
      .sort((a, b) => b.updatedAt - a.updatedAt),
  }));
}
