import { traktRequest } from "./client";
import { readResumeMs, saveResumeMs } from "@/lib/resume";
import type { LibraryItem } from "@/lib/stremio";

// Trakt /sync/playback gives paused / in-progress items. We convert them to
// LibraryItem shape and merge them into Continue Watching so users whose
// progress lives in Trakt (not the Stremio library) get a populated CW row.

type Ids = { imdb?: string; tmdb?: number | string };
type Node = { title?: string; year?: number; ids?: Ids };
type RawSession = {
  progress?: number;
  paused_at?: string;
  type?: string;
  movie?: Node;
  show?: Node;
  episode?: { season?: number; number?: number; title?: string };
};

const DURATION_MS = { movie: 6_300_000, series: 2_640_000 };

function movieMetaId(ids?: Ids): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:movie:${ids.tmdb}`;
  return null;
}

function seriesMetaId(ids?: Ids): string | null {
  if (!ids) return null;
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:tv:${ids.tmdb}`;
  return null;
}

function buildItem(
  id: string,
  type: "movie" | "series",
  node: Node,
  pct: number,
  durMs: number,
  when: string,
  season?: number,
  episode?: number,
): LibraryItem {
  return {
    _id: id,
    type,
    name: node.title ?? "Untitled",
    state: {
      timeOffset: Math.round((pct / 100) * durMs),
      duration: durMs,
      season: season && season > 0 ? season : undefined,
      episode: episode && episode > 0 ? episode : undefined,
      lastWatched: when,
    },
    removed: false,
    temp: false,
    _ctime: when,
    _mtime: when,
    external: "trakt",
  };
}

function toLibraryItem(raw: RawSession): LibraryItem | null {
  const pct = Math.min(100, Math.max(0, raw.progress ?? 0));
  if (pct < 2 || pct > 98) return null;
  const when = raw.paused_at ?? new Date(0).toISOString();

  if (raw.movie) {
    const id = movieMetaId(raw.movie.ids);
    return id ? buildItem(id, "movie", raw.movie, pct, DURATION_MS.movie, when) : null;
  }
  if (raw.show) {
    const id = seriesMetaId(raw.show.ids);
    if (!id) return null;
    return buildItem(
      id,
      "series",
      raw.show,
      pct,
      DURATION_MS.series,
      when,
      raw.episode?.season,
      raw.episode?.number,
    );
  }
  return null;
}

export async function fetchTraktPlaybackItems(): Promise<LibraryItem[]> {
  let raw: RawSession[];
  try {
    raw = await traktRequest<RawSession[]>("/sync/playback?limit=40");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const items: LibraryItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const item = toLibraryItem(r);
    if (!item?.state) continue;
    const key = `${item._id}|${item.state.season ?? ""}|${item.state.episode ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    const existing = readResumeMs(item._id, item.state.season, item.state.episode);
    if (existing <= 0) {
      saveResumeMs(item._id, item.state.timeOffset, item.state.season, item.state.episode);
    }
  }
  return items;
}
