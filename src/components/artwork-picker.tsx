import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { tmdbDetails } from "@/lib/providers/tmdb";
import { setTitleArt } from "@/lib/title-artwork";
import { setTitleBackdrop } from "@/lib/title-backdrop";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";

// Kodi / TMDbHelper-style local artwork override. Open with openArtworkPicker;
// the chosen image is stored locally and used everywhere, surviving refreshes.
let current: Meta | null = null;
const subs = new Set<() => void>();
export function openArtworkPicker(meta: Meta): void {
  current = meta;
  for (const f of subs) f();
}
function closePicker(): void {
  current = null;
  for (const f of subs) f();
}

export function ArtworkPickerHost() {
  const [meta, setMeta] = useState<Meta | null>(current);
  useEffect(() => {
    const f = () => setMeta(current);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  if (!meta) return null;
  return <ArtworkPicker meta={meta} onClose={closePicker} />;
}

type Gallery = { posters: string[]; backdrops: string[]; logos: string[] };

function ArtworkPicker({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [tab, setTab] = useState<"posters" | "backdrops" | "logos">("posters");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (settings.tmdbKey) {
      tmdbDetails(settings.tmdbKey, meta)
        .then((d) => {
          if (!cancelled && d) setGallery(d.gallery);
        })
        .catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [meta, settings.tmdbKey, onClose]);

  const pick = (url: string) => {
    if (tab === "posters") setTitleArt(meta.id, { poster: url });
    else if (tab === "backdrops") setTitleBackdrop(meta.id, url);
    else setTitleArt(meta.id, { logo: url });
    onClose();
  };
  const items = gallery ? gallery[tab] : [];

  // Reset the big preview to the first option whenever the tab / gallery changes.
  useEffect(() => {
    setPreview(items[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gallery]);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex flex-col bg-canvas p-6 lg:p-8">
      {/* Header + tabs on top */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="truncate text-[24px] font-semibold text-ink">
          {t("Choose artwork")} <span className="text-ink-subtle">— {meta.name}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="harbor-card-focus flex h-11 w-11 items-center justify-center rounded-full text-ink-muted outline-none hover:bg-raised focus-visible:bg-raised"
        >
          <X size={22} />
        </button>
      </div>
      <div className="mb-5 flex w-fit gap-1 rounded-full bg-elevated/50 p-1 ring-1 ring-edge-soft/50">
        {(["posters", "backdrops", "logos"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`harbor-card-focus rounded-full px-5 py-2 text-[15px] font-medium outline-none transition-colors ${
              tab === k ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            {k === "posters" ? t("Posters") : k === "backdrops" ? t("Fanart") : t("Logos")}
          </button>
        ))}
      </div>

      {/* Split: big preview on the LEFT, grid of options on the RIGHT */}
      <div className="flex min-h-0 flex-1 gap-8">
        <div className="flex flex-1 items-center justify-center rounded-2xl bg-black/40 p-6 ring-1 ring-edge-soft/40">
          {preview ? (
            <img
              src={preview}
              alt=""
              className={`max-h-full max-w-full rounded-xl object-contain shadow-2xl ${
                tab === "logos" ? "bg-elevated/40 p-8" : ""
              }`}
            />
          ) : (
            <span className="text-[15px] text-ink-subtle">{t("No preview")}</span>
          )}
        </div>

        <div className="flex w-[42%] max-w-[560px] min-w-0 flex-col">
          {!settings.tmdbKey ? (
            <p className="text-[15px] text-ink-muted">{t("Add a TMDB key in settings to change artwork.")}</p>
          ) : !gallery ? (
            <p className="text-[15px] text-ink-muted">{t("Loading…")}</p>
          ) : items.length === 0 ? (
            <p className="text-[15px] text-ink-muted">{t("No options found.")}</p>
          ) : (
            <div
              className="grid gap-4 overflow-y-auto pe-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{
                gridTemplateColumns:
                  tab === "posters"
                    ? "repeat(auto-fill, minmax(140px, 1fr))"
                    : "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              {items.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onClick={() => pick(url)}
                  onMouseEnter={() => setPreview(url)}
                  onFocus={() => setPreview(url)}
                  className={`harbor-card-focus overflow-hidden rounded-lg outline-none ring-1 transition-all focus-visible:scale-105 focus-visible:ring-2 focus-visible:ring-accent ${
                    preview === url ? "ring-2 ring-accent" : "ring-edge-soft/40"
                  } ${tab === "logos" ? "flex items-center justify-center bg-elevated/40 p-3" : ""}`}
                >
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    className={
                      tab === "posters"
                        ? "aspect-[2/3] w-full object-cover"
                        : tab === "backdrops"
                          ? "aspect-video w-full object-cover"
                          : "max-h-14 w-full object-contain"
                    }
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
