import { Fragment, type ComponentType, type ReactNode } from "react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { RtBadge } from "@/components/rt-badge";
import { PopcornBadge } from "@/components/popcorn-badge";
import { useMdblistCardScores } from "@/lib/providers/mdblist-batch";
import { useSettings } from "@/lib/settings";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import traktLogo from "@/assets/trakt.svg";

function metacriticBand(value: number): string {
  if (value >= 61) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

// Consistent banner rating strip used across every hero/banner. Preferred order
// is IMDb, Rotten Tomatoes critics, then RT audience, each with its official
// icon. When a title is missing one of those (e.g. an unreleased film with no
// IMDb score yet) the slot is backfilled from whatever else is available —
// Metacritic, Trakt, Letterboxd — so the strip is never left near-empty. Capped
// so it stays clean on a banner.
export function HeroRatingBadges({
  imdbRating,
  imdbId,
  kind,
  iconClass = "h-[14px] w-auto",
  leadDot = false,
  Dot,
}: {
  imdbRating?: string | null;
  imdbId?: string | null;
  kind: "movie" | "series";
  iconClass?: string;
  leadDot?: boolean;
  Dot?: ComponentType;
}) {
  const { settings } = useSettings();
  const m = useMdblistCardScores(imdbId ?? undefined, kind === "series" ? "show" : "movie");

  const MAX_BADGES = 3;
  // Each candidate: only added when its data exists; `on` marks a preferred
  // source the user has enabled (always shown), vs a backfill-only source.
  const cands: { key: string; on: boolean; node: ReactNode }[] = [];

  // Prefer an explicit IMDb rating, but fall back to mdblist's IMDb value so the
  // IMDb badge shows even when OMDb is unavailable. mdblist gives it as 0–10.
  const imdbValue = imdbRating ?? (m?.imdb != null ? m.imdb.toFixed(1) : null);
  if (imdbValue) {
    cands.push({
      key: "imdb",
      on: settings.showImdbBadge,
      node: (
        <span key="imdb" className="inline-flex items-center gap-1.5">
          <ImdbIcon className={`${iconClass} rounded-[3px]`} />
          {imdbValue}
        </span>
      ),
    });
  }
  if (m?.rtCritics != null) {
    cands.push({
      key: "rt",
      on: settings.showRtBanner,
      node: (
        <span key="rt" className="inline-flex items-center gap-1.5">
          <RtBadge score={m.rtCritics} className={iconClass} />
          {m.rtCritics}%
        </span>
      ),
    });
  }
  if (m?.rtAudience != null) {
    cands.push({
      key: "pop",
      on: settings.showRtBanner,
      node: (
        <span key="pop" className="inline-flex items-center gap-1.5">
          <PopcornBadge score={m.rtAudience} className={iconClass} />
          {Math.round(m.rtAudience)}%
        </span>
      ),
    });
  }
  // Backfill-only sources (shown only to fill empty slots).
  if (m?.metacritic != null) {
    cands.push({
      key: "mc",
      on: false,
      node: (
        <span key="mc" className="inline-flex items-center gap-1.5">
          <span
            className={`flex h-[15px] min-w-[19px] items-center justify-center rounded-[3px] px-1 text-[10px] font-bold text-white ${metacriticBand(m.metacritic)}`}
          >
            {m.metacritic}
          </span>
        </span>
      ),
    });
  }
  if (m?.trakt != null) {
    cands.push({
      key: "trakt",
      on: false,
      node: (
        <span key="trakt" className="inline-flex items-center gap-1.5">
          <img src={traktLogo} alt="" className="h-[14px] w-[14px] object-contain" />
          {Math.round(m.trakt)}%
        </span>
      ),
    });
  }
  if (m?.letterboxd != null) {
    cands.push({
      key: "lb",
      on: false,
      node: (
        <span key="lb" className="inline-flex items-center gap-1.5">
          <img src={letterboxdLogo} alt="" className="h-[14px] w-[14px] rounded-[3px] object-cover" />
          {m.letterboxd.toFixed(1)}
        </span>
      ),
    });
  }

  // Preferred (enabled) first, then backfill to MAX_BADGES, then restore order.
  const chosen = cands.filter((c) => c.on);
  for (const c of cands) {
    if (chosen.length >= MAX_BADGES) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  chosen.sort((a, b) => cands.indexOf(a) - cands.indexOf(b));
  const badges = chosen.slice(0, Math.max(MAX_BADGES, chosen.length)).map((c) => c.node);

  return (
    <>
      {badges.map((b, i) => (
        <Fragment key={i}>
          {(leadDot || i > 0) && Dot ? <Dot /> : null}
          {b}
        </Fragment>
      ))}
    </>
  );
}
