import { Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Poster } from "@/components/poster";
import { PickCard } from "@/components/pick-card";
import { type Meta } from "@/lib/cinemeta";
import { fetchWatchedHistory, type HistoryItem } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { useView } from "@/lib/view";
import { useContextMenu } from "@/lib/context-menu";
import { useT } from "@/lib/i18n";
import { FilterPill } from "./shared";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PAGE = 60;

export function HistoryTab() {
  const t = useT();
  const { isConnected: traktConnected } = useTrakt();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [tab, setTab] = useState<"movies" | "series">("series");
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!traktConnected) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Pull a deep slice of history, then keep the last year of watches.
    fetchWatchedHistory(1000)
      .then((h) => {
        if (cancelled) return;
        const cutoff = Date.now() - YEAR_MS;
        setItems(h.filter((x) => (Date.parse(x.watchedAt) || 0) >= cutoff));
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  const movies = useMemo(() => items.filter((i) => i.type === "movie"), [items]);
  const episodes = useMemo(() => items.filter((i) => i.type === "episode"), [items]);
  const shown = tab === "movies" ? movies : episodes;
  const visible = shown.slice(0, limit);

  // Reset paging when switching tabs.
  useEffect(() => setLimit(PAGE), [tab]);

  // Load more as you scroll.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting) setLimit((l) => l + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length, tab]);

  if (!traktConnected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
        <Clock size={28} strokeWidth={1.6} className="text-ink-subtle" />
        <h2 className="text-[16px] font-semibold text-ink">{t("No history yet")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t("Connect Trakt in Settings to see what you've been watching here.")}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex w-fit items-center gap-1 rounded-full bg-elevated/40 p-0.5 ring-1 ring-edge-soft/60">
        <FilterPill active={tab === "movies"} onClick={() => setTab("movies")}>
          {t("Movies")}
        </FilterPill>
        <FilterPill active={tab === "series"} onClick={() => setTab("series")}>
          {t("Shows")}
        </FilterPill>
      </div>

      {loading && items.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-ink-muted">{t("Syncing Trakt…")}</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-6 py-10 text-center text-[13px] text-ink-muted">
          {tab === "movies" ? t("No movies watched in the last year.") : t("No episodes watched in the last year.")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-8">
            {tab === "movies"
              ? visible.map((m, i) => <PickCard key={`${m.id}-${i}`} meta={movieMeta(m)} />)
              : visible.map((e, i) => <EpisodeCard key={`${e.id}-${i}`} item={e} />)}
          </div>
          {visible.length < shown.length && <div ref={sentinel} className="h-10" />}
        </>
      )}
    </section>
  );
}

function movieMeta(h: HistoryItem): Meta {
  const id = h.imdb && /^tt\d+$/.test(h.imdb) ? h.imdb : h.tmdb ? `tmdb:movie:${h.tmdb}` : h.imdb || "";
  return { id, type: "movie", name: h.title };
}

function EpisodeCard({ item }: { item: HistoryItem }) {
  const { openMeta } = useView();
  const { open: openContextMenu } = useContextMenu();
  const showId =
    item.showImdb && /^tt\d+$/.test(item.showImdb)
      ? item.showImdb
      : item.showTmdb
        ? `tmdb:tv:${item.showTmdb}`
        : "";
  const poster =
    item.showImdb && /^tt\d+$/.test(item.showImdb)
      ? `https://images.metahub.space/poster/medium/${item.showImdb}/img`
      : undefined;
  const showMeta: Meta = { id: showId, type: "series", name: item.title };
  const open = () => {
    if (showId) openMeta(showMeta);
  };
  const tag = `S${item.season} · E${item.number}`;
  return (
    <button
      type="button"
      onClick={open}
      onContextMenu={(e) => showId && openContextMenu(e, { kind: "meta", meta: showMeta })}
      className="harbor-card-focus group flex w-full min-w-0 flex-col gap-2.5 text-start"
    >
      <div className="relative">
        <Poster
          src={poster}
          seed={showId || item.title}
          ratio="portrait"
          className="harbor-card-ring rounded-[var(--poster-radius,12px)] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]"
        />
        <span className="pointer-events-none absolute bottom-1.5 end-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {tag}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-snug text-ink">{item.title}</p>
        <p className="truncate text-[12px] text-ink-muted">{tag}</p>
      </div>
    </button>
  );
}
