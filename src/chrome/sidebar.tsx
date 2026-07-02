import { ChevronDown, Lock, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { OptionsPanel } from "@/chrome/options-panel";
import { useSearch } from "@/lib/search-context";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { PlaylistVodIcon } from "@/components/icons/playlist-vod-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental, type LockableTab } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { isKeyboardNavigating } from "@/lib/spatial-nav";

type NavDef = {
  render: (active: boolean) => ReactNode;
  labelKey: string;
  view?: View;
  hideKey?: "anime" | "liveTv" | "sports";
  parentalKey?: LockableTab;
  pinGated?: boolean;
};

const PRIMARY: NavDef[] = [
  { render: (active) => <HomeIcon active={active} />, labelKey: "nav.home", view: "home" },
  { render: (active) => <DiscoverIcon active={active} />, labelKey: "nav.discover", view: "discover", parentalKey: "discover" },
  { render: (active) => <MoviesIcon active={active} />, labelKey: "nav.movies", view: "movies", parentalKey: "movies" },
  { render: (active) => <TvIcon active={active} />, labelKey: "nav.shows", view: "shows", parentalKey: "shows" },
  { render: (active) => <AnimeIcon active={active} />, labelKey: "nav.anime", view: "anime", hideKey: "anime", parentalKey: "anime" },
  { render: (active) => <LiveTvIcon active={active} />, labelKey: "nav.live", view: "live", hideKey: "liveTv", parentalKey: "liveTv" },
  { render: (active) => <PlaylistVodIcon active={active} />, labelKey: "nav.playlists", view: "vod" },
];

const COLLECTIONS: NavDef[] = [
  { render: (active) => <CalendarIcon active={active} />, labelKey: "nav.calendar", view: "calendar", parentalKey: "calendar" },
  { render: (active) => <LibraryIcon active={active} />, labelKey: "nav.library", view: "library", parentalKey: "library" },
];

export function Sidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const t = useT();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  const collapsed =
    settings.sidebarBehavior === "expanded"
      ? false
      : settings.sidebarBehavior === "collapsed" || settings.sidebarBehavior === "auto"
        ? true
        : settings.sidebarCollapsed; // "remember"

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        className={`relative z-[60] flex w-[72px] shrink-0 flex-col border-e border-edge-soft bg-canvas transition-[opacity,transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[width] ${
          collapsed ? "" : "lg:w-60"
        } ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        {/* Brand logo removed; empty drag region keeps the window drag handle
            and the top offset above the nav. */}
        <div
          data-tauri-drag-region
          className="flex h-8 shrink-0 items-center"
          aria-hidden
        />
        <ScrollableNav
          view={view}
          setView={setView}
          locked={locked}
          collapsed={collapsed}
          hiddenTabs={hiddenTabs}
          onPinNav={(v) => setPendingPinView(v)}
        />
        <div className={`relative p-2 ${collapsed ? "" : "lg:p-4"}`}>
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent ${
              collapsed ? "" : "lg:inset-x-4"
            }`}
          />
          {locked ? (
            <div
              className={`flex w-full items-center justify-center gap-3 rounded-xl py-2.5 ${
                collapsed ? "" : "lg:justify-start lg:px-3"
              }`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-subtle">
                <Lock size={17} />
              </div>
              {!collapsed && (
                <div className="hidden min-w-0 flex-1 lg:block">
                  <div className="truncate text-[13.5px] font-medium text-ink-muted">{t("chrome.locked")}</div>
                  <div className="truncate text-[12px] text-ink-subtle">{t("chrome.parentalOn")}</div>
                </div>
              )}
            </div>
          ) : (
            <ProfileChip collapsed={collapsed} />
          )}
        </div>
      </aside>
      {pendingPinView && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pendingPinView;
              setPendingPinView(null);
              if (v) setView(v);
            },
            onCancel: () => setPendingPinView(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function ScrollableNav({
  view,
  setView,
  locked,
  collapsed,
  hiddenTabs,
  onPinNav,
}: {
  view: View;
  setView: (v: View) => void;
  locked: boolean;
  collapsed: boolean;
  hiddenTabs: Record<LockableTab, boolean>;
  onPinNav: (v: View) => void;
}) {
  const { settings } = useSettings();
  const { setOpen: setSearchOpen } = useSearch();
  const t = useT();
  const isItemVisible = (item: NavDef) => {
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };
  const visiblePrimary = PRIMARY.filter(isItemVisible);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ top: boolean; bottom: boolean }>({
    top: false,
    bottom: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 4;
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
      setOverflow((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollDown = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: 112, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        className="flex flex-1 flex-col overflow-y-auto px-4 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex flex-col gap-1.5">
          <NavItem
            render={() => <Search size={22} strokeWidth={2} />}
            labelKey="Search"
            collapsed={collapsed}
            onClick={() => setSearchOpen(true)}
          />
          {visiblePrimary.map((item) => (
            <NavItem
              key={item.labelKey}
              {...item}
              collapsed={collapsed}
              active={item.view ? view === item.view : false}
              onClick={item.view ? () => setView(item.view!) : undefined}
              peek={item.view ? () => setView(item.view!) : undefined}
            />
          ))}
        </div>
        <div data-tauri-drag-region className="py-2.5">
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent" />
        </div>
        <div className="flex flex-col gap-1.5">
          {COLLECTIONS.filter(isItemVisible).map((item) => {
            const gated = !!item.pinGated && locked;
            return (
              <NavItem
                key={item.labelKey}
                {...item}
                gated={gated}
                collapsed={collapsed}
                active={item.view ? view === item.view : false}
                onClick={
                  item.view
                    ? () => (gated ? onPinNav(item.view!) : setView(item.view!))
                    : undefined
                }
                peek={
                  item.view && !gated && item.view !== "settings"
                    ? () => setView(item.view!)
                    : undefined
                }
              />
            );
          })}
        </div>
        <div data-tauri-drag-region className="flex-1 min-h-2" />
        <div className="flex flex-col gap-1.5">
          <NavItem
            render={() => <Menu size={22} strokeWidth={2} />}
            labelKey="Options"
            collapsed={collapsed}
            active={optionsOpen}
            onClick={() => setOptionsOpen(true)}
          />
        </div>
      </div>
      {optionsOpen && <OptionsPanel onClose={() => setOptionsOpen(false)} />}
      {overflow.top && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-canvas to-transparent" />
      )}
      {overflow.bottom && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />
          <button
            type="button"
            onClick={scrollDown}
            aria-label={t("chrome.scrollForMore")}
            className="absolute bottom-1 left-1/2 flex h-4 w-7 -translate-x-1/2 items-center justify-center text-ink-subtle/55 transition-colors hover:text-ink-muted"
          >
            <ChevronDown size={11} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

function NavItem({
  render,
  labelKey,
  active,
  onClick,
  peek,
  gated,
  collapsed,
  view,
}: {
  render: (active: boolean) => ReactNode;
  labelKey: string;
  active?: boolean;
  onClick?: () => void;
  peek?: () => void;
  gated?: boolean;
  collapsed?: boolean;
  view?: View;
}) {
  const t = useT();
  const label = t(labelKey);
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onFocus={() => {
        // Switch instantly when arrowing/remote-ing across the sidebar.
        if (isKeyboardNavigating()) peek?.();
      }}
      onMouseEnter={() => {
        setHovered(true);
        // Hover-to-switch, like Kodi/Stremio sidebars.
        peek?.();
      }}
      onMouseLeave={() => setHovered(false)}
      data-harbor-nav={view}
      data-active={active ? "" : undefined}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label }) : label}
      title={gated ? t("chrome.lockedShort", { label }) : label}
      className={`relative flex h-14 items-center justify-center gap-4 rounded-xl text-[16px] transition-colors duration-150 ${
        collapsed ? "" : "lg:justify-start lg:px-4"
      } ${
        collapsed
          ? active
            ? "text-accent"
            : "text-ink-muted hover:text-ink"
          : active
            ? "bg-elevated text-ink"
            : "text-ink-muted hover:bg-elevated/50 hover:text-ink"
      }`}
    >
      <span className={`relative ${gated ? "opacity-70" : ""}`}>
        {render(hovered)}
        {gated && (
          <span className="absolute -bottom-1 -end-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      {!collapsed && <span className="hidden lg:inline">{label}</span>}
    </button>
  );
}

