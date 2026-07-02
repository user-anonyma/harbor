import { useSyncExternalStore } from "react";

// Local artwork override (Kodi / TMDbHelper style): the user picks a poster (or
// logo) for a title and it's stored locally + used everywhere, surviving
// metadata refreshes. Backdrops use the sibling title-backdrop store.

const STORAGE_KEY = "harbor:title-artwork";

type Art = { poster?: string; logo?: string };
type Store = Record<string, Art>;

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

let cache: Store = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getTitlePoster(metaId: string): string | undefined {
  return cache[metaId]?.poster;
}
export function getTitleLogo(metaId: string): string | undefined {
  return cache[metaId]?.logo;
}

export function setTitleArt(metaId: string, patch: Art): void {
  cache = { ...cache, [metaId]: { ...cache[metaId], ...patch } };
  persist();
  emit();
}
export function clearTitleArt(metaId: string): void {
  if (!(metaId in cache)) return;
  const next = { ...cache };
  delete next[metaId];
  cache = next;
  persist();
  emit();
}

export function useTitlePoster(metaId: string | undefined): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (metaId ? cache[metaId]?.poster : undefined),
    () => undefined,
  );
}
