import { traktRequest } from "./client";
import { readResumeMs } from "@/lib/resume";
import { readActiveStremioAuthKey } from "@/lib/auth";
import { userAddons, fetchAddonCatalogPage, type Addon } from "@/lib/addons";
import type { LibraryItem } from "@/lib/stremio";

// Continue Watching = the user's Trakt "Up Next". When the Trakt Up Next addon
// is installed we use its catalog as the source of truth for WHICH shows and in
// what order; we still resolve the next episode + still for each. Without the
// addon we fall back to computing up-next from Trakt watched progress.

type Ids = { trakt?: number; imdb?: string; tmdb?: number; slug?: string };
type WatchedShow = { last_watched_at?: string; show: { title?: string; ids: Ids } };
type NextEpisode = {
  season?: number;
  number?: number;
  title?: string;
  first_aired?: string | null;
  images?: { screenshot?: string[] };
};
type Progress = { aired?: number; completed?: number; next_episode?: NextEpisode | null };

const CAP = 60;
const CONCURRENCY = 6;

function seriesId(ids: Ids): string | null {
  if (ids.imdb && /^tt\d+$/.test(ids.imdb)) return ids.imdb;
  if (ids.tmdb) return `tmdb:tv:${ids.tmdb}`;
  return null;
}

let cache: { at: number; items: LibraryItem[] } | null = null;
const CACHE_MS = 30_000;

export function invalidateTraktUpNext(): void {
  cache = null;
}

// Locate the installed Trakt Up Next addon's catalog, if any.
function findUpNextAddon(addons: Addon[]): { base: string; type: string; id: string } | null {
  for (const a of addons) {
    const name = a.manifest?.name ?? "";
    const cats = a.manifest?.catalogs ?? [];
    const cat = cats.find(
      (c) => /up.?next/i.test(c.id ?? "") || /up.?next/i.test(c.name ?? "") || /up.?next/i.test(name),
    );
    if (cat && a.transportUrl) {
      return { base: a.transportUrl.replace(/\/manifest\.json$/, ""), type: cat.type, id: cat.id };
    }
  }
  return null;
}

// Ordered list of imdb ids from the addon catalog (ids look like "tun_tt123..").
// `installed` tells the caller whether the Trakt Up Next addon exists at all, so
// it can distinguish "no addon" (fall back to computed) from "addon present but
// returned nothing this cycle" (keep it empty — never leak abandoned shows).
type UpNextEntry = { imdb: string; name: string };

async function addonUpNextOrder(): Promise<{ installed: boolean; entries: UpNextEntry[] }> {
  const authKey = readActiveStremioAuthKey();
  const addons = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
  const un = findUpNextAddon(addons);
  if (!un) return { installed: false, entries: [] };
  const metas = await fetchAddonCatalogPage(un.base, un.type, un.id, 0).catch(() => []);
  // Preserve the catalog order (the addon lists shows last-watched-first) and
  // carry the show name so the card can label the series under the episode.
  const entries = metas
    .map((m) => ({ imdb: (m.id ?? "").replace(/^tun_/, ""), name: m.name ?? "" }))
    .filter((e) => /^tt\d+$/.test(e.imdb));
  return { installed: true, entries };
}

export async function fetchTraktUpNext(): Promise<LibraryItem[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.items;
  // The installed Trakt Up Next addon is the single source of truth for the exact
  // shows + order. Only when that addon is NOT installed do we compute up-next
  // from raw Trakt progress. If the addon IS installed but a fetch hiccups, we
  // keep the last-known list (or empty) rather than surfacing finished/abandoned
  // shows — that's what caused wrong entries like True Detective to appear.
  const { installed, entries } = await addonUpNextOrder();
  let items: LibraryItem[];
  if (installed) {
    items = entries.length
      ? ((await buildFromEntries(entries)).filter(Boolean) as LibraryItem[])
      : (cache?.items ?? []);
  } else {
    items = await computeUpNext();
  }
  cache = { at: Date.now(), items };
  return items;
}

async function buildFromEntries(entries: UpNextEntry[]): Promise<(LibraryItem | null)[]> {
  const out: (LibraryItem | null)[] = new Array(entries.length).fill(null);
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const res = await Promise.all(
      batch.map((e, j) => buildOneFromImdb(e.imdb, e.name, i + j)),
    );
    for (let j = 0; j < res.length; j++) out[i + j] = res[j];
  }
  return out;
}

// Order index -> a strictly decreasing lastWatched so cwSortKey keeps the
// addon's catalog order (which is last-watched-first).
function orderStamp(orderIndex: number): string {
  return new Date(Date.now() - orderIndex * 60000).toISOString();
}

async function buildOneFromImdb(
  imdb: string,
  seriesTitle = "",
  orderIndex = 0,
): Promise<LibraryItem | null> {
  let pr: Progress;
  try {
    pr = await traktRequest<Progress>(
      `/shows/${imdb}/progress/watched?hidden=false&specials=false&count_specials=false`,
    );
  } catch {
    return null;
  }
  const ne = pr.next_episode;
  if (!ne || ne.season == null || ne.number == null) {
    // Addon listed it but progress has no next episode: still show the show.
    return {
      _id: imdb,
      type: "series",
      name: "",
      poster: `https://images.metahub.space/poster/medium/${imdb}/img`,
      state: { timeOffset: 0, duration: 0, lastWatched: orderStamp(orderIndex) },
      removed: false,
      temp: false,
      _ctime: new Date(0).toISOString(),
      _mtime: new Date(0).toISOString(),
      external: "trakt",
      upNext: true,
      seriesTitle: seriesTitle || undefined,
    };
  }
  const resume = readResumeMs(imdb, ne.season, ne.number);
  const shot = ne.images?.screenshot?.[0];
  return {
    _id: imdb,
    type: "series",
    name: "",
    poster: `https://images.metahub.space/poster/medium/${imdb}/img`,
    background: shot
      ? `https://${shot.replace(/^https?:\/\//, "")}`
      : `https://episodes.metahub.space/${imdb}/${ne.season}/${ne.number}/w780.jpg`,
    state: {
      timeOffset: resume > 0 ? resume : 0,
      duration: 0,
      season: ne.season,
      episode: ne.number,
      lastWatched: orderStamp(orderIndex),
    },
    removed: false,
    temp: false,
    _ctime: new Date().toISOString(),
    _mtime: new Date().toISOString(),
    external: "trakt",
    upNext: true,
    episodeTitle: ne.title?.trim() || undefined,
    seriesTitle: seriesTitle || undefined,
  };
}

async function computeUpNext(): Promise<LibraryItem[]> {
  let watched: WatchedShow[];
  try {
    watched = await traktRequest<WatchedShow[]>("/sync/watched/shows");
  } catch {
    return [];
  }
  if (!Array.isArray(watched)) return [];
  watched.sort((a, b) => (b.last_watched_at ?? "").localeCompare(a.last_watched_at ?? ""));
  const recent = watched.slice(0, CAP);

  const items: LibraryItem[] = [];
  for (let i = 0; i < recent.length; i += CONCURRENCY) {
    const batch = recent.slice(i, i + CONCURRENCY);
    const res = await Promise.all(
      batch.map(async (w) => {
        const tid = w.show.ids.trakt;
        const id = seriesId(w.show.ids);
        if (!tid || !id) return null;
        let pr: Progress;
        try {
          pr = await traktRequest<Progress>(
            `/shows/${tid}/progress/watched?hidden=false&specials=false&count_specials=false`,
          );
        } catch {
          return null;
        }
        const ne = pr.next_episode;
        if (!ne || ne.season == null || ne.number == null) return null;
        const airedAt = ne.first_aired ? Date.parse(ne.first_aired) : NaN;
        if (Number.isFinite(airedAt) && airedAt > Date.now()) return null;
        const when = w.last_watched_at ?? new Date(0).toISOString();
        const resume = readResumeMs(id, ne.season, ne.number);
        const imdb = w.show.ids.imdb;
        const shot = ne.images?.screenshot?.[0];
        const poster =
          imdb && /^tt\d+$/.test(imdb)
            ? `https://images.metahub.space/poster/medium/${imdb}/img`
            : undefined;
        const background = shot
          ? `https://${shot.replace(/^https?:\/\//, "")}`
          : imdb && /^tt\d+$/.test(imdb)
            ? `https://episodes.metahub.space/${imdb}/${ne.season}/${ne.number}/w780.jpg`
            : undefined;
        const item: LibraryItem = {
          _id: id,
          type: "series",
          name: w.show.title ?? "Untitled",
          poster,
          background,
          state: {
            timeOffset: resume > 0 ? resume : 0,
            duration: 0,
            season: ne.season,
            episode: ne.number,
            lastWatched: when,
          },
          removed: false,
          temp: false,
          _ctime: when,
          _mtime: when,
          external: "trakt",
          upNext: true,
          episodeTitle: ne.title?.trim() || undefined,
          seriesTitle: w.show.title ?? undefined,
        };
        return item;
      }),
    );
    for (const it of res) if (it) items.push(it);
  }
  return items;
}
