import { Search, Loader2, CornerDownLeft, CalendarRange, Tag, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { AnimeRow } from "./anime-row";
import { EmptyState } from "./empty-state";
import { GuideModal } from "./guide-modal";
import { LiveTvRow } from "./live-tv-row";
import { PeopleRow } from "./people-row";
import { PickCard } from "@/components/pick-card";
import type { Meta } from "@/lib/cinemeta";
import { OnscreenKeyboard } from "./onscreen-keyboard";
import { AddonHits } from "./addon-hits";
import { AddonResults } from "./addon-results";
import { MagnetCard } from "./magnet-card";
import { UrlCard } from "./url-card";
import { AiSearchSection } from "./ai-search-section";
import { isMagnetInput, isDirectVideoUrl } from "@/lib/torrent/magnet";

export function SearchOverlay() {
  const { open, setOpen, query, setQuery, results, status, recordRecent } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const { openFilter, openMeta } = useView();
  const t = useT();
  const [guideOpen, setGuideOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [show, setShow] = useState({
    movies: true,
    shows: true,
    people: true,
    live: true,
    anime: true,
    addons: true,
  });
  const toggleShow = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Backspace leaves the search page — but only when you're NOT in the text box
  // (so it still deletes characters while typing). Capture phase so it beats the
  // global spatial-nav Backspace handler.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      const t = e.target as HTMLElement | null;
      const typing =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || !!t?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  const close = () => {
    if (query.trim() && results) recordRecent(query);
    setOpen(false);
  };

  const onIntent = () => {
    const intent = results?.intent;
    if (!intent) return;
    if (intent.kind === "genre") {
      const id = (intent.mediaType === "movie" ? MOVIE_GENRES : TV_GENRES)[intent.genre];
      if (typeof id === "number") {
        recordRecent(query);
        openFilter({ kind: "genre", mediaType: intent.mediaType, name: intent.genre, id });
        setOpen(false);
      }
      return;
    }
    if (intent.kind === "year") {
      recordRecent(query);
      openFilter({ kind: "year", mediaType: "movie", value: intent.year });
      setOpen(false);
    }
  };

  const trimmed = query.trim();
  const magnetInput = !!trimmed && isMagnetInput(trimmed);
  const urlInput = !!trimmed && !magnetInput && isDirectVideoUrl(trimmed);
  const directInput = magnetInput || urlInput;
  const hasResults =
    results &&
    trimmed &&
    (results.topMatch ||
      results.people.length ||
      results.movies.length ||
      results.series.length ||
      results.liveTv.length ||
      results.anime.length ||
      results.addons.length ||
      results.addonGroups.length);
  const noResults =
    results &&
    trimmed &&
    status === "done" &&
    !results.topMatch &&
    results.people.length === 0 &&
    results.movies.length === 0 &&
    results.series.length === 0 &&
    results.liveTv.length === 0 &&
    results.anime.length === 0 &&
    results.addons.length === 0 &&
    results.addonGroups.length === 0;

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex bg-canvas">
      {/* Left column: search field + on-screen keyboard (TV/remote driven) */}
      <div className="flex h-full w-[460px] max-w-[94vw] shrink-0 flex-col gap-4 border-e border-edge-soft/50 p-6">
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-edge-soft/80 bg-elevated/70 px-5">
          <Search size={22} className="shrink-0 text-ink-muted" strokeWidth={1.9} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results?.topMatch) {
                e.preventDefault();
                recordRecent(query);
                const meta = results.topMatch.meta;
                setOpen(false);
                openMeta(meta);
                return;
              }
              // Arrow out of the text box into the on-screen keyboard / results so
              // the whole page is remote-drivable, not just the input.
              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                const root = e.currentTarget.closest('[role="dialog"]');
                const focusables = root
                  ? Array.from(
                      root.querySelectorAll<HTMLElement>(
                        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
                      ),
                    ).filter((el) => el !== e.currentTarget)
                  : [];
                if (focusables.length) {
                  e.preventDefault();
                  focusables[0].focus();
                }
              }
            }}
            placeholder={t("Search movies, shows, people, genres, years...")}
            className="h-16 flex-1 bg-transparent text-[20px] text-ink placeholder:text-ink-subtle focus:outline-none sm:text-[22px]"
            spellCheck={false}
            autoComplete="off"
          />
          {status === "loading" && <Loader2 size={18} className="shrink-0 animate-spin text-ink-subtle" />}
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            aria-label={t("Filter")}
            className="harbor-card-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted outline-none transition-colors hover:bg-canvas/60 hover:text-ink focus-visible:bg-canvas/60"
          >
            <Filter size={18} strokeWidth={2.1} />
          </button>
        </div>

        {filterOpen && (
          <div className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-edge-soft/60 bg-elevated/60 p-3">
            {(
              [
                ["movies", t("Movies")],
                ["shows", t("TV Shows")],
                ["people", t("People")],
                ["live", t("Live TV")],
                ["anime", t("Anime")],
                ["addons", t("Add-ons")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleShow(k)}
                className={`harbor-card-focus rounded-full px-3 py-1.5 text-[13px] font-medium outline-none transition-colors ${
                  show[k]
                    ? "bg-accent text-white"
                    : "bg-elevated/60 text-ink-muted ring-1 ring-edge-soft/50 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex shrink-0 justify-center">
          <OnscreenKeyboard value={query} onChange={setQuery} />
        </div>

        <div className="flex-1" />

        {trimmed && results && (
          <div className="flex max-h-[36%] shrink-0 flex-col gap-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...results.movies, ...results.series].slice(0, 6).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  recordRecent(query);
                  setOpen(false);
                  openMeta(m);
                }}
                className="harbor-card-focus truncate rounded-md px-3 py-2.5 text-start text-[19px] font-medium text-ink-muted outline-none transition-colors hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink"
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Right column: the results wall, split into Movies / TV Shows / People */}
      <div className="relative flex-1 overflow-x-hidden overflow-y-auto p-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!trimmed && <EmptyState onClose={close} onOpenGuide={() => setGuideOpen(true)} />}

          {magnetInput && (
            <div className="mb-5">
              <MagnetCard raw={trimmed} onClose={close} />
            </div>
          )}

          {urlInput && (
            <div className="mb-5">
              <UrlCard raw={trimmed} onClose={close} />
            </div>
          )}

          {trimmed && !directInput && results?.intent && (
            <button
              onClick={onIntent}
              className="mb-5 flex h-14 w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-5 text-start transition-colors hover:bg-accent/15"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent">
                {results.intent.kind === "year" ? (
                  <CalendarRange size={16} strokeWidth={2.1} />
                ) : (
                  <Tag size={16} strokeWidth={2.1} />
                )}
              </span>
              <span className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                  {t("Browse")}
                </span>
                <span className="text-[15px] font-semibold text-ink">{results.intent.label}</span>
              </span>
              <CornerDownLeft size={15} className="ms-auto text-ink-subtle" />
            </button>
          )}

          {trimmed && !directInput && <AiSearchSection query={trimmed} onClose={close} />}

          {trimmed && !directInput && hasResults && results && (
            <div className="flex flex-col gap-10 pb-12">
              {show.movies && results.movies.length > 0 && (
                <PosterWall title={t("Movies")} items={results.movies} />
              )}
              {show.shows && results.series.length > 0 && (
                <PosterWall title={t("TV Shows")} items={results.series} />
              )}
              {show.anime && <AnimeRow items={results.anime} onClose={close} />}
              {show.people && <PeopleRow people={results.people} onClose={close} />}
              {show.live && <LiveTvRow items={results.liveTv} onClose={close} />}
              {show.addons && <AddonHits hits={results.addons} onClose={close} />}
              {show.addons && <AddonResults groups={results.addonGroups} onClose={close} />}
            </div>
          )}

          {noResults && !directInput && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <span className="text-[17px] font-semibold text-ink">{t("No matches for \"{query}\"", { query: trimmed })}</span>
              <span className="max-w-[44ch] text-[14px] text-ink-muted">
                {t("Try a different spelling, a person's name, a year like \"1972\", or a genre like \"Horror\".")}
              </span>
            </div>
          )}

          {trimmed && !directInput && !results && status !== "done" && (
            <div className="flex flex-col items-center gap-3 pt-16 text-ink-muted">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-[13.5px]">{t("Looking…")}</span>
            </div>
          )}
        </div>
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>,
    document.body,
  );
}


function PosterWall({ title, items }: { title: string; items: Meta[] }) {
  const { settings } = useSettings();
  // Respect the app-wide poster-size setting so the wall matches everywhere.
  const min = Math.max(120, Math.round(200 * settings.posterScale));
  return (
    <section>
      <h3 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </h3>
      <div
        className="grid gap-x-5 gap-y-10"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}
      >
        {items.slice(0, 60).map((m, i) => (
          <PickCard key={`${m.id}-${i}`} meta={m} hideTitle />
        ))}
      </div>
    </section>
  );
}
