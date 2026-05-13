"use client";

import { get, set, del, keys } from "idb-keyval";
import type {
  Notebook,
  Source,
  ChatMessage,
  Note,
  StudioArtifact,
} from "./types";

/**
 * Client-side persistence layer backed by IndexedDB via idb-keyval.
 *
 * Keys are namespaced as:
 *   notebook:{id}
 *   sources:{notebookId}
 *   messages:{notebookId}
 *   notes:{notebookId}
 *   artifacts:{notebookId}
 *   notebook-index
 */

const NB_INDEX_KEY = "notebook-index";

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === "undefined") return fallback;
  try {
    const v = await get<T>(key);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeSet<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(key, value);
  } catch (e) {
    console.error("idb set failed for", key, e);
  }
}

export async function listNotebooks(): Promise<Notebook[]> {
  const ids = await safeGet<string[]>(NB_INDEX_KEY, []);
  const result: Notebook[] = [];
  for (const id of ids) {
    const nb = await safeGet<Notebook | null>(`notebook:${id}`, null);
    if (nb) result.push(nb);
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveNotebook(nb: Notebook): Promise<void> {
  await safeSet(`notebook:${nb.id}`, nb);
  const ids = await safeGet<string[]>(NB_INDEX_KEY, []);
  if (!ids.includes(nb.id)) {
    ids.push(nb.id);
    await safeSet(NB_INDEX_KEY, ids);
  }
}

export async function deleteNotebook(id: string): Promise<void> {
  await del(`notebook:${id}`);
  await del(`sources:${id}`);
  await del(`messages:${id}`);
  await del(`notes:${id}`);
  await del(`artifacts:${id}`);
  const ids = await safeGet<string[]>(NB_INDEX_KEY, []);
  await safeSet(
    NB_INDEX_KEY,
    ids.filter((x) => x !== id),
  );
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  return safeGet<Notebook | null>(`notebook:${id}`, null);
}

export const sourcesStore = {
  list: (notebookId: string) =>
    safeGet<Source[]>(`sources:${notebookId}`, []),
  save: (notebookId: string, sources: Source[]) =>
    safeSet(`sources:${notebookId}`, sources),
};

export const messagesStore = {
  list: (notebookId: string) =>
    safeGet<ChatMessage[]>(`messages:${notebookId}`, []),
  save: (notebookId: string, messages: ChatMessage[]) =>
    safeSet(`messages:${notebookId}`, messages),
};

export const notesStore = {
  list: (notebookId: string) =>
    safeGet<Note[]>(`notes:${notebookId}`, []),
  save: (notebookId: string, notes: Note[]) =>
    safeSet(`notes:${notebookId}`, notes),
};

export const artifactsStore = {
  list: (notebookId: string) =>
    safeGet<StudioArtifact[]>(`artifacts:${notebookId}`, []),
  save: (notebookId: string, artifacts: StudioArtifact[]) =>
    safeSet(`artifacts:${notebookId}`, artifacts),
};

export async function debugAllKeys(): Promise<IDBValidKey[]> {
  if (typeof window === "undefined") return [];
  try {
    return await keys();
  } catch {
    return [];
  }
}
