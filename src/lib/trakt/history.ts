import { traktRequest } from "./client";
import type { TraktTarget } from "./types";

export type HistoryItem = {
  id: number;
  watchedAt: string;
  type: "movie" | "episode";
  imdb?: string;
  tmdb?: number;
  title: string;
  year: number | null;
  showImdb?: string;
  showTmdb?: number;
  season?: number;
  number?: number;
};

export async function fetchWatchedHistory(limit = 200): Promise<HistoryItem[]> {
  type Raw = {
    id: number;
    watched_at: string;
    type: "movie" | "episode";
    movie?: {
      title: string;
      year: number | null;
      ids: { imdb?: string; tmdb?: number };
    };
    episode?: {
      season: number;
      number: number;
      title?: string;
      ids: { imdb?: string; tmdb?: number };
    };
    show?: {
      title: string;
      year: number | null;
      ids: { imdb?: string; tmdb?: number };
    };
  };
  const rows = await traktRequest<Raw[]>(`/sync/history?limit=${limit}`).catch(
    () => [] as Raw[],
  );
  return rows.map((r) => {
    if (r.type === "movie" && r.movie) {
      return {
        id: r.id,
        watchedAt: r.watched_at,
        type: "movie" as const,
        title: r.movie.title,
        year: r.movie.year,
        imdb: r.movie.ids.imdb,
        tmdb: r.movie.ids.tmdb,
      };
    }
    return {
      id: r.id,
      watchedAt: r.watched_at,
      type: "episode" as const,
      title: r.show?.title ?? "",
      year: r.show?.year ?? null,
      showImdb: r.show?.ids.imdb,
      showTmdb: r.show?.ids.tmdb,
      season: r.episode?.season,
      number: r.episode?.number,
    };
  });
}

export async function pushWatched(target: TraktTarget): Promise<boolean> {
  try {
    if (target.kind === "movie") {
      await traktRequest("/sync/history", {
        method: "POST",
        body: { movies: [{ ids: target.ids }] },
      });
      return true;
    }
    if (target.kind === "episode") {
      await traktRequest("/sync/history", {
        method: "POST",
        body: {
          shows: [
            {
              ids: target.show.ids,
              seasons: [
                { number: target.season, episodes: [{ number: target.number }] },
              ],
            },
          ],
        },
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

type WatchedShowRow = { show?: { ids?: { imdb?: string; tmdb?: number } } };
type WatchedMovieRow = { movie?: { ids?: { imdb?: string; tmdb?: number } } };

// Complete set of watched TITLE keys (imdb:tt.. / tmdb:N) from Trakt's full
// watched library (not the time-capped history), so the watched indicator
// covers everything ever watched, including old shows.
export async function fetchWatchedTitleKeys(): Promise<Set<string>> {
  const set = new Set<string>();
  const [shows, movies] = await Promise.all([
    traktRequest<WatchedShowRow[]>("/sync/watched/shows?extended=noseasons").catch(() => []),
    traktRequest<WatchedMovieRow[]>("/sync/watched/movies").catch(() => []),
  ]);
  for (const s of shows ?? []) {
    const ids = s?.show?.ids;
    if (ids?.imdb) set.add(`imdb:${ids.imdb}`);
    if (ids?.tmdb) set.add(`tmdb:${ids.tmdb}`);
  }
  for (const m of movies ?? []) {
    const ids = m?.movie?.ids;
    if (ids?.imdb) set.add(`imdb:${ids.imdb}`);
    if (ids?.tmdb) set.add(`tmdb:${ids.tmdb}`);
  }
  return set;
}

export type WatchedItem = {
  id: string;
  type: "movie" | "series";
  name: string;
  lastWatched: number;
};

// Full watched library as items (for the Watchlist tab, which also surfaces
// things you've watched that aren't on your saved watchlist).
export async function fetchWatchedItems(): Promise<WatchedItem[]> {
  type ShowRow = {
    last_watched_at?: string;
    show?: { title?: string; ids?: { imdb?: string; tmdb?: number } };
  };
  type MovieRow = {
    last_watched_at?: string;
    movie?: { title?: string; ids?: { imdb?: string; tmdb?: number } };
  };
  const [shows, movies] = await Promise.all([
    traktRequest<ShowRow[]>("/sync/watched/shows?extended=noseasons").catch(() => []),
    traktRequest<MovieRow[]>("/sync/watched/movies").catch(() => []),
  ]);
  const out: WatchedItem[] = [];
  for (const s of shows ?? []) {
    const ids = s?.show?.ids;
    const id =
      ids?.imdb && /^tt\d+$/.test(ids.imdb)
        ? ids.imdb
        : ids?.tmdb
          ? `tmdb:tv:${ids.tmdb}`
          : null;
    if (id) out.push({ id, type: "series", name: s.show?.title ?? "", lastWatched: Date.parse(s.last_watched_at ?? "") || 0 });
  }
  for (const m of movies ?? []) {
    const ids = m?.movie?.ids;
    const id =
      ids?.imdb && /^tt\d+$/.test(ids.imdb)
        ? ids.imdb
        : ids?.tmdb
          ? `tmdb:movie:${ids.tmdb}`
          : null;
    if (id) out.push({ id, type: "movie", name: m.movie?.title ?? "", lastWatched: Date.parse(m.last_watched_at ?? "") || 0 });
  }
  return out;
}

export async function fetchWatchedKeySet(): Promise<Set<string>> {
  const rows = await fetchWatchedHistory(1000);
  const set = new Set<string>();
  for (const r of rows) {
    if (r.type === "movie") {
      if (r.imdb) set.add(`imdb:${r.imdb}`);
      if (r.tmdb) set.add(`tmdb:${r.tmdb}`);
    } else {
      if (r.showImdb && r.season != null && r.number != null) {
        set.add(`imdb:${r.showImdb}:${r.season}:${r.number}`);
      }
      if (r.showTmdb && r.season != null && r.number != null) {
        set.add(`tmdb:${r.showTmdb}:${r.season}:${r.number}`);
      }
    }
  }
  return set;
}
