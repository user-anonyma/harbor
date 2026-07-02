import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Settings, Puzzle, Download, RefreshCw, Power, X, ChevronRight } from "lucide-react";
import { useView } from "@/lib/view";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { close as closeWindow } from "@/lib/window";

// Kodi-style Options panel: a focused overlay that holds the utility actions
// (Settings, Addons, Downloads) plus Settings / Restart / Quit, so the sidebar
// stays clean for TV navigation.
export function OptionsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { setView } = useView();
  const { activeProfile } = useProfiles();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus into the panel and trap Esc/Backspace to close.
    const first = panelRef.current?.querySelector<HTMLElement>("[data-opt]");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const go = (v: Parameters<typeof setView>[0]) => {
    setView(v);
    onClose();
  };
  const restart = () => {
    void import("@tauri-apps/plugin-process")
      .then((m) => m.relaunch())
      .catch(() => window.location.reload());
  };
  const quit = () => closeWindow();

  const now = new Date();
  const day = now.toLocaleDateString(undefined, { weekday: "long" });
  const date = now.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[440px] max-w-[94vw] flex-col gap-5 rounded-2xl border border-edge-soft/60 bg-surface/97 p-7 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-ink">
            {t("Options")} <span className="text-ink-subtle">— {time}</span>
          </h2>
          <button
            type="button"
            data-opt
            onClick={onClose}
            className="harbor-card-focus flex h-9 w-9 items-center justify-center rounded-full text-ink-muted outline-none hover:bg-raised focus-visible:bg-raised"
            aria-label={t("Close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-elevated/50 px-4 py-3 ring-1 ring-edge-soft/40">
          <div>
            <div className="text-[15px] font-semibold text-ink">{day}</div>
            <div className="text-[13px] text-ink-muted">{date}</div>
          </div>
          {activeProfile?.avatar ? (
            <img src={activeProfile.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white"
              style={{ background: activeProfile?.color ?? "#e5484d" }}
            >
              {(activeProfile?.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <button
          type="button"
          data-opt
          onClick={() => go("settings")}
          className="harbor-card-focus flex items-center gap-3 rounded-xl bg-accent/90 px-5 py-4 text-start text-white outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
        >
          <Settings size={20} />
          <span className="text-[17px] font-semibold">{t("Settings")}</span>
        </button>

        <div className="flex flex-col">
          <OptRow icon={<Puzzle size={18} />} label={t("Add-ons")} onClick={() => go("addons")} />
          <OptRow icon={<Download size={18} />} label={t("Downloads")} onClick={() => go("downloads")} />
        </div>

        <div className="mt-auto flex items-center justify-center gap-6 border-t border-edge-soft/40 pt-6">
          <FootBtn icon={<Settings size={22} />} label={t("Settings")} onClick={() => go("settings")} />
          <FootBtn icon={<RefreshCw size={22} />} label={t("Restart")} onClick={restart} />
          <FootBtn icon={<Power size={22} />} label={t("Quit")} onClick={quit} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OptRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-opt
      onClick={onClick}
      className="harbor-card-focus flex items-center justify-between rounded-xl px-5 py-4 text-start outline-none transition-colors hover:bg-raised focus-visible:bg-raised"
    >
      <span className="text-[17px] font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2 text-ink-muted">
        {icon}
        <ChevronRight size={16} className="text-ink-subtle" />
      </span>
    </button>
  );
}

function FootBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-opt
      onClick={onClick}
      aria-label={label}
      title={label}
      className="harbor-card-focus flex h-12 w-12 items-center justify-center rounded-full text-ink-muted outline-none transition-colors hover:bg-raised hover:text-ink focus-visible:bg-raised focus-visible:text-ink"
    >
      {icon}
    </button>
  );
}
