import { useEffect, useMemo, useState } from "react";
import { isCwMember, type LibraryItem } from "@/lib/stremio";
import { stremioMovieWatched } from "@/lib/stremio-watched";

// Lightweight, reactive index of watch state keyed by library item id, so any
// poster card can show a watched check / in-progress ring without each card
// fetching the library. Populated from the library load in the home view
// (mirrors the watchlist.ts aggregate pattern).

export type WatchState = {
  watched: boolean;
  inProgress: boolean;
  progress: number; // 0..1, playback position for movies (0 for series)
};

const index = new Map<string, WatchState>();
// Title-level watched keys from Trakt history (e.g. "imdb:tt0141842", "tmdb:1234").
// Covers titles watched on Trakt that aren't in the Stremio library.
let traktTitleWatched = new Set<string>();
const subs = new Set<() => void>();

// Normalize a meta id to a Trakt title key, matching home's watched-key format.
function titleKey(id: string): string | null {
  if (/^tt\d+$/.test(id)) return `imdb:${id}`;
  if (id.startsWith("imdb:")) return id.split(":").slice(0, 2).join(":");
  if (id.startsWith("tmdb:")) {
    const parts = id.split(":");
    const num = Number(parts[parts.length - 1]);
    if (Number.isFinite(num)) return `tmdb:${num}`;
  }
  return null;
}

// Feed the raw Trakt watched key set (episode-granular, e.g. "imdb:tt..:1:2").
// We reduce each to its title key (first two segments) so a show counts as
// watched anywhere it appears.
export function setTraktWatchedIndex(rawKeys: Set<string>): void {
  const s = new Set<string>();
  for (const k of rawKeys) {
    const parts = k.split(":");
    if (parts.length >= 2) s.add(`${parts[0]}:${parts[1]}`);
  }
  traktTitleWatched = s;
  for (const f of subs) f();
}

// Optimistically mark a title watched (instant green check) after the user
// marks it from the context menu; the Trakt sync then confirms it.
export function addWatchedTitle(id: string): void {
  const tk = titleKey(id);
  if (!tk) return;
  traktTitleWatched.add(tk);
  for (const f of subs) f();
}

export function setWatchStateIndex(items: LibraryItem[]): void {
  index.clear();
  for (const it of items) {
    if (!it?._id) continue;
    const dur = it.state?.duration ?? 0;
    const off = it.state?.timeOffset ?? 0;
    const progress = dur > 0 ? Math.min(1, off / dur) : 0;
    const watched = stremioMovieWatched(it) || (it.state?.flaggedWatched ?? 0) > 0;
    const inProgress = !watched && isCwMember(it);
    if (!watched && !inProgress) continue; // only index items with a state
    index.set(it._id, { watched, inProgress, progress });
  }
  for (const s of subs) s();
}

export function watchStateFor(ids: string[]): WatchState | null {
  for (const id of ids) {
    const s = index.get(id);
    if (s) return s;
  }
  // Fall back to Trakt title-level watched history.
  for (const id of ids) {
    const tk = titleKey(id);
    if (tk && traktTitleWatched.has(tk)) {
      return { watched: true, inProgress: false, progress: 1 };
    }
  }
  return null;
}

export function useWatchState(
  id: string | undefined,
  altIds?: Array<string | null | undefined>,
): WatchState | null {
  const candidates = useMemo(() => {
    const arr: string[] = [];
    if (id) arr.push(id);
    if (altIds) for (const a of altIds) if (a) arr.push(a);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, altIds?.join("|")]);

  const check = () => watchStateFor(candidates);
  const [state, setState] = useState<WatchState | null>(check);
  useEffect(() => {
    setState(check());
    const tick = () => setState(check());
    subs.add(tick);
    return () => {
      subs.delete(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates.join("|")]);
  return state;
}
