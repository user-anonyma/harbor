import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { pickRandom } from "@/lib/feed/tags";
import { tmdbMovieImages, useTmdbImdbId } from "@/lib/providers/tmdb";
import { useMdblistCardScores } from "@/lib/providers/mdblist-batch";
import { useSettings } from "@/lib/settings";
import { ImdbIcon } from "../icons/imdb-icon";
import { RtBadge } from "../rt-badge";
import { PopcornBadge } from "../popcorn-badge";
import type { LightboxState } from "./types";

export function SidePanel({
  meta,
  activeIndex,
  total,
  onOpenLightbox,
}: {
  meta: Meta;
  activeIndex: number;
  total: number;
  onOpenLightbox: (state: LightboxState) => void;
}) {
  const { settings } = useSettings();
  const [stills, setStills] = useState<string[]>([]);
  const resolvedImdb = useTmdbImdbId(meta.id);
  const scores = useMdblistCardScores(
    resolvedImdb ?? undefined,
    meta.type === "series" ? "show" : "movie",
  );

  useEffect(() => {
    if (!settings.tmdbKey) {
      setStills([]);
      return;
    }
    let cancelled = false;
    tmdbMovieImages(settings.tmdbKey, meta.id)
      .then((urls) => {
        if (cancelled) return;
        setStills(urls);
      })
      .catch(() => {
        if (cancelled) return;
        setStills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.id, settings.tmdbKey]);

  const fallbackBackdrop = meta.background ?? meta.poster;

  const tiles = useMemo(() => {
    const sample = stills.length > 4 ? pickRandom(stills, 4, Date.now() ^ stills.length) : stills;
    return Array.from({ length: 4 }, (_, i) => sample[i] ?? fallbackBackdrop);
  }, [stills, fallbackBackdrop]);

  const lightboxImages = stills.length > 0
    ? stills
    : fallbackBackdrop
      ? [fallbackBackdrop]
      : [];

  const openAt = (tileSrc: string | undefined) => {
    if (!tileSrc || lightboxImages.length === 0) return;
    const startIndex = Math.max(0, lightboxImages.indexOf(tileSrc));
    onOpenLightbox({ images: lightboxImages, startIndex, title: meta.name });
  };

  return (
    <aside className="flex flex-col gap-3 self-start rounded-2xl border border-edge-soft bg-elevated/35 p-4">
      <div className="flex flex-col gap-1">
        <h4 className="line-clamp-1 font-display text-[19px] font-medium tracking-tight text-ink">
          {meta.name}
        </h4>
        <span className="text-[12px] uppercase tracking-[0.16em] text-ink-subtle">
          {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((src, i) => (
          <Still
            key={`${meta.id}-${i}`}
            src={src}
            alt={meta.name}
            onClick={lightboxImages.length > 0 ? () => openAt(src) : undefined}
          />
        ))}
      </div>
      {meta.description && (
        <p className="text-[12.5px] leading-snug text-ink-muted line-clamp-3">
          {meta.description}
        </p>
      )}
      {(meta.imdbRating || scores?.rtCritics != null || scores?.rtAudience != null) && (
        <div className="mt-auto flex flex-wrap items-center gap-3 rounded-full border border-edge-soft bg-canvas/40 px-3 py-1.5 text-[12px] font-semibold text-ink self-start">
          {settings.showImdbBadge && meta.imdbRating && (
            <span className="inline-flex items-center gap-1.5">
              <ImdbIcon className="h-[13px] w-auto rounded-[2px]" />
              {meta.imdbRating}
            </span>
          )}
          {settings.showRtBanner && scores?.rtCritics != null && (
            <span className="inline-flex items-center gap-1.5">
              <RtBadge score={scores.rtCritics} className="h-[13px] w-auto" />
              {scores.rtCritics}%
            </span>
          )}
          {settings.showRtBanner && scores?.rtAudience != null && (
            <span className="inline-flex items-center gap-1.5">
              <PopcornBadge score={scores.rtAudience} className="h-[13px] w-auto" />
              {Math.round(scores.rtAudience)}%
            </span>
          )}
        </div>
      )}
    </aside>
  );
}

function Still({
  src,
  alt,
  onClick,
}: {
  src: string | undefined;
  alt: string;
  onClick?: () => void;
}) {
  if (!src) {
    return <div className="aspect-[16/9] rounded-md bg-elevated/45" />;
  }
  if (!onClick) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-edge-soft">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onClick}
      aria-label={`Expand ${alt} image`}
      className="group/still relative aspect-[16/9] overflow-hidden rounded-md border border-edge-soft transition-colors duration-200 hover:border-ink"
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/still:scale-[1.04]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-canvas/0 transition-colors duration-200 group-hover/still:bg-canvas/20"
      />
    </button>
  );
}
