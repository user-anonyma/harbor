import { Bookmark, BookmarkCheck, Check, ClipboardPaste, Copy, Download, Film, Info, ListPlus, ListVideo, Maximize, Navigation, Play, RotateCcw, Star, UserPlus, Wallpaper, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useActiveAddon } from "@/lib/active-addon";
import { useContextMenu, type ViewSummonable } from "@/lib/context-menu";
import { usePlayerActions } from "@/lib/player-actions";
import { useTogether } from "@/lib/together/provider";
import type { ParticipantLocation } from "@/lib/together/protocol";
import { useView } from "@/lib/view";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { pushWatched } from "@/lib/trakt/history";
import { addWatchedTitle } from "@/lib/watch-state";
import { invalidateTraktUpNext } from "@/lib/trakt/up-next";
import { openArtworkPicker } from "@/components/artwork-picker";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useImdbRating } from "@/lib/imdb-rating";
import { useMdblistCardScores } from "@/lib/providers/mdblist-batch";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { RtBadge } from "@/components/rt-badge";
import { PopcornBadge } from "@/components/popcorn-badge";
import type { Meta } from "@/lib/cinemeta";
import { useTitlePoster } from "@/lib/title-artwork";
import { useIsFavorite, useMediaFavorites } from "@/lib/media-favorites";
import { useInLocalWatchlist, useLocalWatchlist } from "@/lib/local-watchlist";
import { clearTitleBackdrop, getTitleBackdrop, setTitleBackdrop } from "@/lib/title-backdrop";
import { useT } from "@/lib/i18n";

const MENU_WIDTH = 220;
const MENU_HEIGHT = 120;
const EMPTY_META = { id: "", type: "movie", name: "" } as Meta;

function isEditableTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el.isContentEditable) return true;
  return false;
}

const VIEW_LABELS: Record<ViewSummonable, string> = {
  home: "Home",
  discover: "Discover",
  anime: "Anime",
  queue: "My Library",
  addons: "Addons",
};

type BigAction = {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
};

export function ContextMenu() {
  const { state, close, open } = useContextMenu();
  const t = useT();
  const {
    openMeta,
    setView,
    openQueue,
    openPicker,
    openPerson,
    openService,
    openAddonDetail,
    openSettings,
    meta: currentMeta,
    topKind,
    chromeHidden,
  } = useView();
  const { snapshot, sendSummon, hostLocation, clientId } = useTogether();
  const playerActions = usePlayerActions();
  const activeAddon = useActiveAddon();
  const ref = useRef<HTMLDivElement>(null);

  const inSession = snapshot.state === "joined";
  const isHost = inSession && snapshot.hostClientId === clientId;
  const canGoToHost = inSession && !isHost && hostLocation != null;
  const targetMetaId = state?.target.kind === "meta" ? state.target.meta.id : undefined;
  const targetMeta = state?.target.kind === "meta" ? state.target.meta : null;
  const targetImdb = useTmdbImdbId(targetMetaId);
  const cmImdb = useImdbRating(targetMeta ?? EMPTY_META, targetImdb);
  const cmScores = useMdblistCardScores(
    targetImdb ?? undefined,
    targetMeta?.type === "series" ? "show" : "movie",
  );
  const overridePoster = useTitlePoster(targetMetaId);
  const isWatchlisted = useInWatchlist(targetMetaId, [targetImdb]);
  const { toggle: toggleFavorite } = useMediaFavorites();
  const isFav = useIsFavorite(targetMetaId);
  const { toggle: toggleLocalList } = useLocalWatchlist();
  const isLocal = useInLocalWatchlist(targetMetaId);

  const goToHost = () => {
    if (!hostLocation) return;
    navigateToLocation(hostLocation, {
      openMeta,
      openPicker,
      openPerson,
      openService,
      openAddonDetail,
      openSettings,
      setView,
      openQueue,
    });
    close();
  };

  useEffect(() => {
    if (chromeHidden) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (topKind === "settings") {
        const el = isEditableTarget(e.target) ? e.target : null;
        if (!el) return;
        e.preventDefault();
        const selection = window.getSelection()?.toString() ?? "";
        open(e, { kind: "edit", element: el, selection });
        return;
      }
      if (topKind === "person") return;
      if (e.target instanceof HTMLElement && e.target.closest("[data-person-card]")) return;
      const backdropEl =
        e.target instanceof HTMLElement ? e.target.closest("[data-title-backdrop]") : null;
      if (backdropEl && currentMeta) {
        const backdropUrl = backdropEl.getAttribute("data-title-backdrop");
        if (backdropUrl) {
          e.preventDefault();
          open(e, { kind: "backdrop", metaId: currentMeta.id, url: backdropUrl });
          return;
        }
      }
      if (currentMeta) {
        e.preventDefault();
        open(e, { kind: "meta", meta: currentMeta });
        return;
      }
      if (topKind === "addon-detail") {
        if (activeAddon) {
          e.preventDefault();
          open(e, { kind: "addon", addonId: activeAddon.id, label: activeAddon.name });
        }
        return;
      }
      const view = topKindToView(topKind);
      if (view) {
        e.preventDefault();
        open(e, { kind: "view", view, label: VIEW_LABELS[view] });
      }
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [open, currentMeta, topKind, chromeHidden, activeAddon]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  // Focus the first action when the big panel opens, so a remote can drive it.
  useEffect(() => {
    if (!state || state.target.kind !== "meta" || playerActions) return;
    const id = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>("[data-cm-first]")?.focus();
    }, 40);
    return () => window.clearTimeout(id);
  }, [state, playerActions]);

  if (!state) return null;

  // ---- Big Kodi-style panel: context menu on a title (not while playing) ----
  if (state.target.kind === "meta" && !playerActions) {
    const meta = state.target.meta;
    const episode = state.target.episode; // set for Continue Watching items
    const done = () => close();
    const handleDetails = () => {
      openMeta(meta);
      done();
    };
    const handleWatchlist = () => {
      toggleWatchlist({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, imdbId: targetImdb });
      done();
    };
    const handleMarkWatched = () => {
      const imdb = targetImdb ?? (meta.id.startsWith("tt") ? meta.id : undefined);
      const tmdbNum = meta.id.startsWith("tmdb:") ? Number(meta.id.split(":").pop()) : undefined;
      const ids = { imdb, tmdb: Number.isFinite(tmdbNum) ? tmdbNum : undefined };
      void pushWatched(meta.type === "series" ? { kind: "show", ids } : { kind: "movie", ids });
      addWatchedTitle(meta.id);
      invalidateTraktUpNext();
      done();
    };
    const handlePlay = () => {
      openPicker(meta, episode);
      done();
    };
    const handlePlayNext = () => {
      openPicker(meta, episode, { autoPlay: true });
      done();
    };
    const handleArtwork = () => {
      openArtworkPicker(meta);
      done();
    };
    const handleRefresh = () => {
      openMeta(meta);
      done();
    };
    const handleFavorite = () => {
      toggleFavorite({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster });
      done();
    };
    const handleLocalList = () => {
      toggleLocalList({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster });
      done();
    };

    // Item order per the Kodi reference build.
    const actions: BigAction[] = [
      {
        id: "trakt",
        icon: isWatchlisted ? <BookmarkCheck size={20} strokeWidth={2} /> : <Bookmark size={20} strokeWidth={2} />,
        label: isWatchlisted ? "Trakt options (in watchlist)" : "Trakt options",
        onClick: handleWatchlist,
        accent: true,
      },
      { id: "tmdb", icon: <Film size={20} strokeWidth={2} />, label: "TMDb user options", onClick: handleLocalList },
      { id: "refresh", icon: <RotateCcw size={20} strokeWidth={2} />, label: "Refresh details", onClick: handleRefresh },
      { id: "artwork", icon: <Wallpaper size={20} strokeWidth={2} />, label: "Modify artwork", onClick: handleArtwork },
      { id: "play", icon: <Play size={20} strokeWidth={2} fill="currentColor" />, label: "Play", onClick: handlePlay },
      { id: "play-next", icon: <ListVideo size={20} strokeWidth={2} />, label: "Play next", onClick: handlePlayNext },
      { id: "queue", icon: <ListPlus size={20} strokeWidth={2} />, label: isLocal ? "Queued" : "Queue item", onClick: handleLocalList },
      { id: "info", icon: <Info size={20} strokeWidth={2} />, label: "Information", onClick: handleDetails },
      { id: "watched", icon: <Check size={20} strokeWidth={2.4} />, label: "Mark as watched", onClick: handleMarkWatched },
      {
        id: "fav",
        icon: <Star size={20} strokeWidth={2} fill={isFav ? "currentColor" : "none"} />,
        label: isFav ? "In favourites" : "Add to favourites",
        onClick: handleFavorite,
        accent: isFav,
      },
    ];
    if (canGoToHost) {
      actions.unshift({ id: "host", icon: <Navigation size={20} strokeWidth={2} />, label: "Go to host", onClick: goToHost });
    }
    if (inSession) {
      actions.push({
        id: "bring",
        icon: <UserPlus size={20} strokeWidth={2} />,
        label: "Bring friends here",
        onClick: () => {
          sendSummon({
            mediaId: meta.id,
            mediaType: meta.type === "series" ? "series" : "movie",
            mediaTitle: meta.name,
            posterUrl: meta.poster,
            backgroundUrl: meta.background,
            releaseInfo: meta.releaseInfo,
          });
          openMeta(meta);
          done();
        },
      });
    }

    const poster = overridePoster || meta.poster;
    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-stretch justify-end bg-black/55 p-4 backdrop-blur-sm animate-popover-in"
        onMouseDown={close}
      >
        {/* The "hovering" preview card, off to the side (left of the panel). */}
        <div className="hidden self-center pe-4 lg:block" onMouseDown={(e) => e.stopPropagation()}>
          <div className="w-[300px] overflow-hidden rounded-2xl border border-edge-soft/60 bg-surface/95 shadow-2xl">
            {poster && (
              <div className="aspect-[2/3] w-full overflow-hidden bg-elevated">
                <img src={poster} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-1.5 p-4">
              <h3 className="text-[19px] font-semibold leading-tight text-ink">{meta.name}</h3>
              {meta.releaseInfo && <p className="text-[13px] text-ink-muted">{meta.releaseInfo}</p>}
              {(cmImdb || cmScores?.rtCritics != null || cmScores?.rtAudience != null) && (
                <div className="mt-0.5 flex items-center gap-3 text-[13px] font-semibold text-ink">
                  {cmImdb && (
                    <span className="inline-flex items-center gap-1.5">
                      <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
                      {cmImdb}
                    </span>
                  )}
                  {cmScores?.rtCritics != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <RtBadge score={cmScores.rtCritics} className="h-[15px] w-auto" />
                      {cmScores.rtCritics}%
                    </span>
                  )}
                  {cmScores?.rtAudience != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <PopcornBadge score={cmScores.rtAudience} className="h-[15px] w-auto" />
                      {Math.round(cmScores.rtAudience)}%
                    </span>
                  )}
                </div>
              )}
              {meta.description && (
                <p className="mt-1 line-clamp-5 text-[13.5px] leading-relaxed text-ink-muted">
                  {meta.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* The context-menu panel, same size/placement as the Options panel. */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={t("Context menu")}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-full w-[440px] max-w-[94vw] flex-col rounded-2xl border border-edge-soft/60 bg-surface/97 p-6 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[22px] font-semibold text-ink">{t("Context menu")}</h2>
            <button
              type="button"
              onClick={close}
              aria-label={t("Close")}
              className="harbor-card-focus flex h-10 w-10 items-center justify-center rounded-full text-ink-muted outline-none hover:bg-raised focus-visible:bg-raised"
            >
              <X size={22} />
            </button>
          </div>
          <div className="my-2 h-px bg-edge-soft/50" />
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {actions.map((a, i) => (
              <BigItem key={a.id} {...a} first={i === 0} />
            ))}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ---- Small popup: player, editable fields, backdrop, view/addon summon ----
  const left = Math.min(state.pos.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(state.pos.y, window.innerHeight - MENU_HEIGHT - 8);
  const items: React.ReactNode[] = [];

  if (canGoToHost) {
    items.push(
      <Item key="go-to-host" icon={<Navigation size={14} strokeWidth={2} />} label="Go to host" onClick={goToHost} accent />,
      <Separator key="go-to-host-sep" />,
    );
  }

  if (state.target.kind === "meta") {
    // meta while playing: player-specific actions
    const meta = state.target.meta;
    const handlePlay = () => {
      openPicker(meta);
      close();
    };
    items.push(
      <Item key="play" icon={<Play size={14} strokeWidth={2} fill="currentColor" />} label="Play" onClick={handlePlay} />,
      <Item key="details" icon={<Info size={14} strokeWidth={2} />} label="Information" onClick={() => { openMeta(meta); close(); }} />,
    );
    if (playerActions) {
      items.push(<Separator key="player-sep" />);
      items.push(
        <Item
          key="fullscreen"
          icon={<Maximize size={14} strokeWidth={2} />}
          label="Full screen"
          onClick={() => {
            playerActions.toggleFullscreen();
            close();
          }}
        />,
      );
      if (playerActions.canDownload) {
        items.push(
          <Item key="download" icon={<Download size={14} strokeWidth={2} />} label="Download Video" onClick={() => { playerActions.download(); close(); }} />,
        );
      }
      if (playerActions.canDownloadSubtitle) {
        items.push(
          <Item key="download-subtitle" icon={<Download size={14} strokeWidth={2} />} label={t("Download Subtitle")} onClick={() => { playerActions.downloadSubtitle(); close(); }} />,
        );
      }
    }
  } else if (state.target.kind === "view") {
    const { view, label } = state.target;
    if (inSession) {
      const handleBringPage = () => {
        sendSummon({ view, label });
        if (view === "queue") openQueue();
        else setView(view);
        close();
      };
      items.push(
        <Item key="bring-page" icon={<UserPlus size={14} strokeWidth={2} />} label={`Bring friends to ${label}`} onClick={handleBringPage} />,
      );
    }
  } else if (state.target.kind === "addon") {
    const { addonId, label } = state.target;
    if (inSession) {
      items.push(
        <Item key="bring-addon" icon={<UserPlus size={14} strokeWidth={2} />} label={`Bring friends to ${label}`} onClick={() => { sendSummon({ addonId, label }); close(); }} />,
      );
    }
  } else if (state.target.kind === "backdrop") {
    const { metaId, url } = state.target;
    const isCurrent = getTitleBackdrop(metaId) === url;
    items.push(
      <Item key="set-title-backdrop" icon={<Wallpaper size={14} strokeWidth={2} />} label="Set as a backdrop" onClick={() => { setTitleBackdrop(metaId, url); close(); }} accent={isCurrent} />,
    );
    if (getTitleBackdrop(metaId)) {
      items.push(
        <Item key="reset-title-backdrop" icon={<RotateCcw size={14} strokeWidth={2} />} label="Reset to original" onClick={() => { clearTitleBackdrop(metaId); close(); }} />,
      );
    }
  } else {
    const { element, selection } = state.target;
    const canCopy = selection.length > 0;
    const canPaste = element != null;
    const handleCopy = async () => {
      if (!canCopy) return;
      try {
        await navigator.clipboard.writeText(selection);
      } catch {}
      close();
    };
    const handlePaste = async () => {
      if (!canPaste || !element) return;
      try {
        const text = await navigator.clipboard.readText();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          const start = element.selectionStart ?? element.value.length;
          const end = element.selectionEnd ?? element.value.length;
          element.value = element.value.slice(0, start) + text + element.value.slice(end);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          element.focus();
          const cursor = start + text.length;
          element.setSelectionRange(cursor, cursor);
        } else if (element.isContentEditable) {
          element.focus();
          document.execCommand("insertText", false, text);
        }
      } catch {}
      close();
    };
    items.push(
      <Item key="copy" icon={<Copy size={14} strokeWidth={2} />} label="Copy" onClick={handleCopy} disabled={!canCopy} />,
      <Item key="paste" icon={<ClipboardPaste size={14} strokeWidth={2} />} label="Paste" onClick={handlePaste} disabled={!canPaste} />,
    );
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[145] flex flex-col rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items}
    </div>
  );
}

function topKindToView(topKind: string): ViewSummonable | null {
  if (topKind === "home" || topKind === "discover" || topKind === "anime" || topKind === "queue") {
    return topKind;
  }
  if (topKind === "addons" || topKind === "addon-detail") return "addons";
  return null;
}

type LocationNavigators = {
  openMeta: ReturnType<typeof useView>["openMeta"];
  openPicker: ReturnType<typeof useView>["openPicker"];
  openPerson: ReturnType<typeof useView>["openPerson"];
  openService: ReturnType<typeof useView>["openService"];
  openAddonDetail: ReturnType<typeof useView>["openAddonDetail"];
  openSettings: ReturnType<typeof useView>["openSettings"];
  setView: ReturnType<typeof useView>["setView"];
  openQueue: ReturnType<typeof useView>["openQueue"];
};

function navigateToLocation(loc: ParticipantLocation, nav: LocationNavigators) {
  switch (loc.kind) {
    case "home":
    case "discover":
    case "anime":
    case "addons":
      nav.setView(loc.kind);
      return;
    case "queue":
      nav.openQueue();
      return;
    case "settings":
      nav.openSettings();
      return;
    case "service":
      nav.openService(loc.service as Parameters<typeof nav.openService>[0]);
      return;
    case "addon-detail":
      nav.openAddonDetail(loc.addonId);
      return;
    case "person":
      nav.openPerson(loc.personId);
      return;
    case "meta":
      nav.openMeta(loc.meta);
      return;
    case "picker":
    case "player":
      nav.openPicker(loc.meta, loc.episode, { autoPlay: true });
      return;
  }
}

// Big TV-sized row for the Kodi-style context panel.
function BigItem({ icon, label, onClick, accent, first }: BigAction & { first?: boolean }) {
  return (
    <button
      role="menuitem"
      data-cm-first={first ? "" : undefined}
      onClick={onClick}
      className={`harbor-card-focus flex h-[52px] shrink-0 items-center gap-4 rounded-xl px-5 text-start text-[17px] outline-none transition-colors ${
        accent
          ? "bg-accent/90 text-white hover:bg-accent focus-visible:bg-accent"
          : "text-ink hover:bg-raised focus-visible:bg-raised"
      }`}
    >
      <span className={accent ? "text-white" : "text-ink-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function Item({
  icon,
  label,
  onClick,
  accent,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors ${
        disabled
          ? "cursor-not-allowed text-ink-subtle/55"
          : accent
            ? "text-accent hover:bg-raised"
            : "text-ink hover:bg-raised"
      }`}
    >
      <span className={disabled ? "text-ink-subtle/40" : accent ? "text-accent" : "text-ink-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function Separator() {
  return <span aria-hidden className="my-1 h-px bg-edge-soft/60" />;
}
