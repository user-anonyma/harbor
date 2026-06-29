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
const subs = new Set<() => void>();

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
