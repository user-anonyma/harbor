import { Clock } from "lucide-react";
import { PopcornBadge } from "@/components/popcorn-badge";
import type { ReactNode } from "react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { RtBadge } from "@/components/rt-badge";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import type { OmdbScores } from "@/lib/providers/omdb";
import type { MdblistScores } from "@/lib/providers/mdblist";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import traktLogo from "@/assets/trakt.svg";

function ScoreItem({
  label,
  sublabel,
  onClick,
  children,
}: {
  label: string;
  sublabel?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const inner = (
    <span className="flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold text-ink">
      {children}
    </span>
  );
  return (
    <HoverTooltip label={label} sublabel={sublabel} side="top" align="center">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center rounded-full transition-colors hover:bg-canvas/90"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </HoverTooltip>
  );
}

function Divider() {
  return <span className="h-3.5 w-px bg-edge-soft/60" aria-hidden />;
}

// Parse a runtime value ("1 hr 40 mins", "100 min", "2h 7m", or minutes) to
// total minutes, or null if not parseable.
export function runtimeToMinutes(rt?: string | number | null): number | null {
  if (rt == null) return null;
  if (typeof rt === "number") return rt > 0 ? Math.round(rt) : null;
  const s = String(rt);
  let total = 0;
  let matched = false;
  const h = s.match(/(\d+)\s*h/i);
  if (h) {
    total += parseInt(h[1], 10) * 60;
    matched = true;
  }
  const m = s.match(/(\d+)\s*m/i);
  if (m) {
    total += parseInt(m[1], 10);
    matched = true;
  }
  if (!matched) {
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) total = n;
  }
  return total > 0 ? total : null;
}

// Wall-clock time the title finishes if you start it now, e.g. "12:51 AM".
function formatEndsAt(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function metacriticBand(value: number): string {
  if (value >= 61) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function HeroRatings({
  rating,
  isAnime,
  scores,
  mdblist,
  showRtBadge,
  imdbId,
  mediaType,
  onOpenUrl,
  ratingSource = "imdb",
  runtime,
}: {
  rating?: string;
  isAnime: boolean;
  scores: OmdbScores | null;
  mdblist: MdblistScores | null;
  showRtBadge: boolean;
  imdbId: string | null;
  mediaType: "movie" | "show";
  onOpenUrl: (url: string) => void;
  ratingSource?: "imdb" | "tmdb";
  runtime?: string | number | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const metacritic = mdblist?.metacritic ?? scores?.metascore ?? null;
  const endsAtMinutes = runtimeToMinutes(runtime);
  const rtCriticsValue = scores?.rtCritics ?? mdblist?.rtCritics ?? null;
  // IMDb: use the explicit IMDb rating when we have one, otherwise fall back to
  // mdblist's IMDb value (0–10) — which is an authentic IMDb score — so the IMDb
  // badge shows even when OMDb/Cinemeta are down and the rating source degraded
  // to TMDb. Anime keeps its MyAnimeList score in `rating`. We never show a bare
  // TMDb number dressed up as IMDb.
  const imdbValue = isAnime
    ? rating
    : (ratingSource === "imdb" ? rating : undefined) ??
      (mdblist?.imdb != null ? mdblist.imdb.toFixed(1) : undefined);

  // Each possible rating chip, in priority order, but only when its data exists
  // for this specific title. `on` is whether the user has that source enabled.
  // We show every enabled+available source, then backfill from the remaining
  // available-but-disabled sources so a sparse title (e.g. an unreleased film
  // with no IMDb yet) still fills its rating slots instead of showing one lone
  // score. Target at least MIN_RATINGS chips whenever the data is there.
  const MIN_RATINGS = 3;
  const cands: { key: string; on: boolean; node: ReactNode }[] = [];

  if (imdbValue) {
    cands.push({
      key: "imdb",
      on: isAnime || settings.showImdbBadge,
      node: (
        <ScoreItem
          key="imdb"
          label={isAnime ? t("MyAnimeList") : t("IMDb")}
          sublabel={isAnime ? t("Score /10") : t("Rating /10")}
          onClick={
            !isAnime && imdbId ? () => onOpenUrl(`https://www.imdb.com/title/${imdbId}/`) : undefined
          }
        >
          {isAnime ? (
            <MalLogo className="h-[14px] w-auto text-ink-muted" />
          ) : (
            <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
          )}
          <span>{imdbValue}</span>
        </ScoreItem>
      ),
    });
  }

  if (rtCriticsValue != null) {
    cands.push({
      key: "rt-critics",
      on: showRtBadge,
      node: (
        <ScoreItem key="rt-critics" label={t("Rotten Tomatoes Critics")} sublabel={t("Tomatometer")}>
          <RtBadge score={rtCriticsValue} className="h-[16px] w-auto" />
          <span>{rtCriticsValue}%</span>
        </ScoreItem>
      ),
    });
  }

  if (mdblist?.rtAudience != null) {
    cands.push({
      key: "rt-audience",
      on: settings.showPopcornBadge,
      node: (
        <ScoreItem key="rt-audience" label={t("Rotten Tomatoes Audience")} sublabel={t("Popcornmeter")}>
          <PopcornBadge score={mdblist.rtAudience} className="h-[16px] w-auto" />
          <span>{Math.round(mdblist.rtAudience)}%</span>
        </ScoreItem>
      ),
    });
  }

  if (metacritic != null) {
    cands.push({
      key: "metacritic",
      on: settings.showMetacriticBadge,
      node: (
        <ScoreItem key="metacritic" label={t("Metacritic")} sublabel={t("Metascore")}>
          <span
            className={`flex h-[18px] min-w-[22px] items-center justify-center rounded-[4px] px-1 text-[11px] font-bold text-white ${metacriticBand(metacritic)}`}
          >
            {metacritic}
          </span>
        </ScoreItem>
      ),
    });
  }

  if (mdblist?.trakt != null) {
    cands.push({
      key: "trakt",
      on: settings.showTraktBadge,
      node: (
        <ScoreItem
          key="trakt"
          label={t("Trakt")}
          onClick={imdbId ? () => onOpenUrl(`https://trakt.tv/search/imdb/${imdbId}`) : undefined}
        >
          <img src={traktLogo} alt="" className="h-[14px] w-[14px] object-contain" />
          <span>{Math.round(mdblist.trakt)}%</span>
        </ScoreItem>
      ),
    });
  }

  if (mdblist?.letterboxd != null) {
    cands.push({
      key: "letterboxd",
      on: settings.showLetterboxdBadge,
      node: (
        <ScoreItem
          key="letterboxd"
          label={t("Letterboxd")}
          sublabel={t("Average /5")}
          onClick={imdbId ? () => onOpenUrl(`https://letterboxd.com/imdb/${imdbId}/`) : undefined}
        >
          <img src={letterboxdLogo} alt="" className="h-[14px] w-[14px] rounded-[3px] object-cover" />
          <span>{mdblist.letterboxd.toFixed(1)}</span>
        </ScoreItem>
      ),
    });
  }

  if (mdblist?.score != null) {
    cands.push({
      key: "mdblist",
      on: settings.showMdblistBadge,
      node: (
        <ScoreItem
          key="mdblist"
          label={t("MDBList")}
          onClick={imdbId ? () => onOpenUrl(`https://mdblist.com/${mediaType}/${imdbId}`) : undefined}
        >
          <img src={mdblistLogo} alt="" className="h-[14px] w-[14px] rounded-[3px] object-contain" />
          <span>{Math.round(mdblist.score)}</span>
        </ScoreItem>
      ),
    });
  }

  // Pick enabled sources first, then backfill from available disabled ones up to
  // MIN_RATINGS, then restore priority order for a clean, consistent row.
  const chosen = cands.filter((c) => c.on);
  for (const c of cands) {
    if (chosen.length >= MIN_RATINGS) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  chosen.sort((a, b) => cands.indexOf(a) - cands.indexOf(b));
  const items: ReactNode[] = chosen.map((c) => c.node);

  if (endsAtMinutes) {
    items.push(
      <ScoreItem key="ends-at" label={t("Ends at")} sublabel={t("If you start now")}>
        <Clock size={14} strokeWidth={2} className="text-ink-muted" />
        <span>
          {t("Ends at")} {formatEndsAt(endsAtMinutes)}
        </span>
      </ScoreItem>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="inline-flex items-center rounded-full border border-edge-soft bg-canvas/70 px-1 py-0.5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <Divider />}
          {item}
        </span>
      ))}
    </div>
  );
}
