import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import simklLogo from "@/assets/simkl.png";
import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { animeKitsuMeta, type AnimeKitsuVideo } from "@/lib/providers/anime-kitsu-addon";
import { tmdbLiteMeta } from "@/lib/providers/tmdb/tmdb-lite";
import { useContextMenu } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { readSnapshot, useSnapshotVersion } from "@/lib/snapshots";
import { episodeFromVideoId, isAnimeCwItem, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import { useHasNewEpisode } from "@/lib/new-episodes";
import { Tooltip } from "@/views/detail/tooltip";
import { useSettings } from "@/lib/settings";
import { useView, type PlayEpisode } from "@/lib/view";

type Props = {
  item: LibraryItem;
  watched?: boolean;
  onDismiss?: (item: LibraryItem) => void;
};

export const ContinueCard = memo(function ContinueCard({ item, watched = false }: Props) {
  const { openMeta } = useView();
  const t = useT();
  const { settings } = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { open: openContextMenu } = useContextMenu();
  useSnapshotVersion();
  const newEpisode = useHasNewEpisode(item);
  const snapshot = readSnapshot(item._id);
  const isExternal = item.external === "simkl";
  const dur = item.state?.duration ?? 0;
  const off = item.state?.timeOffset ?? 0;
  const progress = dur > 0 ? Math.min(1, off / dur) : 0;
  const remaining = dur > 0 && !isExternal ? formatRemaining(t, dur - off) : "";
  const upNext = item.upNext === true;
  const kitsuThreeSeg =
    /^(kitsu|mal|anilist|anidb):/.test(item._id) &&
    (item.state?.video_id ?? "").split(":").length === 3;
  const ep =
    item.state?.season && item.state?.episode
      ? { season: item.state.season, episode: item.state.episode }
      : kitsuThreeSeg
        ? null
        : episodeFromVideoId(item.state?.video_id);
  const animeEp = kitsuThreeSeg
    ? Number((item.state?.video_id ?? "").split(":")[2])
    : isAnimeCwItem(item) && ep
      ? ep.episode
      : null;
  const sub =
    animeEp && Number.isFinite(animeEp) && animeEp > 0
      ? `Ep ${animeEp}`
      : ep
        ? `S${ep.season}E${ep.episode}`
        : "";
  const [metaBg, setMetaBg] = useState<string | undefined>();
  const [epStill, setEpStill] = useState<string | undefined>();
  const [epTitle, setEpTitle] = useState<string | undefined>();
  const [hydratedMeta, setHydratedMeta] = useState<Meta | null>(null);
  const [kitsuVideo, setKitsuVideo] = useState<AnimeKitsuVideo | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const cardRef = useRef<HTMLButtonElement>(null);
  const pressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);
  // Resolve the exact episode this card is resuming, so the context menu acts on
  // that episode (Continue Watching), not just the show.
  const cwEpisode = (): PlayEpisode | undefined => {
    if (item.type === "series" && ep) return { season: ep.season, episode: ep.episode };
    if (kitsuVideo) {
      return {
        season: kitsuVideo.season || 1,
        episode: kitsuVideo.episode,
        name: kitsuVideo.title,
        still: kitsuVideo.thumbnail,
        overview: kitsuVideo.overview,
        kitsuStreamId: kitsuVideo.id,
        imdbId: kitsuVideo.imdb_id,
        imdbSeason: kitsuVideo.imdbSeason,
        imdbEpisode: kitsuVideo.imdbEpisode,
      };
    }
    return undefined;
  };

  const openMenuHere = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    openContextMenu(
      {
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        preventDefault() {},
        stopPropagation() {},
      } as unknown as Parameters<typeof openContextMenu>[0],
      { kind: "meta", meta, episode: cwEpisode() },
    );
  };

  const candidates = useMemo(() => {
    const thumb = item.type === "movie" ? snapshot : undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    // Prefer the current episode's still (Kodi-style) for series/anime; fall
    // back to the show backdrop/poster via the onError chain if it is missing.
    for (const u of [epStill, thumb, metaBg, item.background, item.poster]) {
      if (!u) continue;
      const d = downscaleTmdb(u)!;
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
  }, [epStill, snapshot, metaBg, item.background, item.poster, item.type]);

  const src = candidates[imgIdx];

  useEffect(() => {
    setMetaBg(undefined);
    setEpStill(undefined);
    setEpTitle(item.episodeTitle); // seed from Up Next; a video lookup may refine it
    setHydratedMeta(null);
    setKitsuVideo(null);
    setImgIdx(0);
    const el = cardRef.current;
    if (!el) return;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      if (/^(kitsu|mal|anilist|anidb):/.test(item._id)) {
        animeKitsuMeta(item._id)
          .then((m) => {
            if (cancelled || !m) return;
            setHydratedMeta({
              id: item._id,
              type: libraryMetaType(item.type),
              name: m.name?.trim() ? m.name : item.name,
              poster: m.poster,
              background: m.background,
              logo: m.logo,
            });
            const bg = m.background || m.poster;
            if (bg) setMetaBg(bg);
            if (kitsuThreeSeg) {
              const vid =
                m.videos.find((v) => v.id === item.state?.video_id) ??
                m.videos.find((v) => v.episode === animeEp);
              if (vid) setKitsuVideo(vid);
            }
            // Use the current episode's still image when available.
            const av =
              m.videos.find((v) => v.id === item.state?.video_id) ??
              (animeEp ? m.videos.find((v) => v.episode === animeEp) : undefined) ??
              (ep ? m.videos.find((v) => v.season === ep.season && v.episode === ep.episode) : undefined);
            if (av?.thumbnail) setEpStill(av.thumbnail);
            if (av?.title) setEpTitle(av.title);
          })
          .catch(() => {});
        return;
      }
      if (item._id.startsWith("tmdb:")) {
        tmdbLiteMeta(settingsRef.current.tmdbKey, item._id)
          .then((m) => {
            if (cancelled || !m) return;
            setHydratedMeta({
              id: item._id,
              type: libraryMetaType(item.type),
              name: m.name?.trim() ? m.name : item.name,
              poster: m.poster ?? item.poster,
              background: m.background ?? item.background,
            });
            const bg = m.background || m.poster;
            if (bg) setMetaBg(bg);
          })
          .catch(() => {});
        return;
      }
      const looksEpisodic = item.type === "movie" && episodeFromVideoId(item.state?.video_id);
      fetchMeta(looksEpisodic ? "series" : narrowMediaType(item.type), item._id)
        .then((full) => {
          if (cancelled || !full) return;
          setHydratedMeta(full);
          const bg = full.background || full.poster;
          if (bg) setMetaBg(bg);
          // Use the current episode's still image (Kodi-style) when available.
          if (ep && Array.isArray(full.videos)) {
            const v = full.videos.find(
              (vv) => vv.season === ep.season && vv.episode === ep.episode,
            );
            if (v?.thumbnail) setEpStill(v.thumbnail);
            if (v?.name || v?.title) setEpTitle(v.name || v.title);
          }
        })
        .catch(() => {});
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          start();
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [item._id, item.type, item.state?.video_id]);

  const meta: Meta = hydratedMeta
    ? { ...hydratedMeta, id: item._id, type: libraryMetaType(item.type) }
    : {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      };

  const onClick = () => {
    openMeta(meta);
  };


  return (
    <div className="relative w-full min-w-0">
      <button
        ref={cardRef}
        data-focus-id={item._id}
        onClick={() => {
          if (didLongPress.current) {
            didLongPress.current = false;
            return;
          }
          onClick();
        }}
        onContextMenu={(e) => openContextMenu(e, { kind: "meta", meta, episode: cwEpisode() })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.repeat) {
            const el = e.currentTarget;
            didLongPress.current = false;
            pressTimer.current = window.setTimeout(() => {
              didLongPress.current = true;
              openMenuHere(el);
            }, 2000);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" && pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
        }}
        className="harbor-card-focus group flex w-full min-w-0 flex-col gap-2.5 text-start"
      >
      <div className="harbor-poster harbor-card-ring relative aspect-[16/9] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] will-change-transform [transform:translate3d(0,0,0)] transition-transform duration-[220ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02] group-focus-within:scale-[1.02]">
        <div className="absolute inset-0 bg-gradient-to-br from-raised via-elevated to-surface" />
        {src && (
          <img
            key={src}
            src={src}
            alt=""
            decoding="sync"
            onError={() => setImgIdx((i) => i + 1)}
            className="absolute inset-0 h-full w-full object-cover brightness-95"
          />
        )}
        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.45)]" />
        {watched && (
          <span
            className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm"
            title={t("Watched on Trakt")}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {newEpisode > 0 && (
          <span className={`absolute top-2 ${watched ? "start-10" : "start-2"}`}>
            <Tooltip
              label={
                newEpisode === 1
                  ? t("1 new episode since you last watched")
                  : t("{n} new episodes since you last watched", { n: newEpisode })
              }
              side="bottom"
            >
              <span className="flex h-6 items-center rounded-full bg-accent/90 px-2 text-[10px] font-bold tracking-[0.1em] text-canvas">
                +{newEpisode}
              </span>
            </Tooltip>
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/80 to-transparent" />
        {(sub || remaining || isExternal) && (
          <div className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-md bg-canvas/95 px-2 py-1 text-[11px]">
            {isExternal && !upNext ? (
              <img src={simklLogo} alt="" className="h-3.5 w-3.5 rounded-sm" title={t("Paused on Simkl")} />
            ) : (
              <Play size={11} fill="currentColor" className="text-ink" />
            )}
            {sub && <span className="font-medium text-ink">{sub}</span>}
            {sub && remaining && <span className="text-ink-subtle">·</span>}
            {remaining && <span className="text-ink-muted">{remaining}</span>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/40">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      {epTitle ? (
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-ink">{epTitle}</p>
          <p className="truncate text-[14px] text-ink-muted">
            {hydratedMeta?.name?.trim() || item.seriesTitle || item.name}
          </p>
        </div>
      ) : (
        <p className="truncate text-[16px] font-semibold text-ink">
          {hydratedMeta?.name?.trim() || item.seriesTitle || item.name}
        </p>
      )}
      </button>
    </div>
  );
});

function downscaleTmdb(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/(original|w1280|w780|w500)\//, "/t/p/w300/");
}

function formatRemaining(t: (key: string, vars?: Record<string, string | number>) => string, ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return t("{m}m left", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? t("{h}h left", { h }) : t("{h}h {m}m left", { h, m });
}
