import { useMemo, useState } from "react";
import { HarborLoader } from "@/components/harbor-loader";
import { PickCard } from "@/components/pick-card";
import { useT } from "@/lib/i18n";
import { useCustomLists } from "../lists/use-custom-lists";
import { useListItems } from "../lists/use-list-items";
import { FilterPill } from "./shared";

// Favorites = the user's MDBList list, shown as a Kodi-style wall split into
// Films / Series. Reuses the same list infrastructure as the Lists view.
export function FavoritesTab() {
  const t = useT();
  const { lists } = useCustomLists();
  const favorites = useMemo(
    () => lists.find((l) => l.source === "mdblist") ?? lists[0] ?? null,
    [lists],
  );
  const { items, loading, error } = useListItems(favorites, true);

  const films = useMemo(() => items.filter((m) => m.type === "movie"), [items]);
  const series = useMemo(
    () => items.filter((m) => m.type === "series" || m.type === "tv"),
    [items],
  );
  const hasBoth = films.length > 0 && series.length > 0;
  const [tab, setTab] = useState<"films" | "series">("films");
  const shown = !hasBoth ? items : tab === "films" ? films : series;

  if (!favorites) {
    return (
      <p className="text-[14px] text-ink-muted">
        {t("Add your MDBList key in Settings, then your favorites show up here.")}
      </p>
    );
  }
  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <HarborLoader size="sm" />
      </div>
    );
  }
  if (error) return <p className="text-[14px] text-ink-muted">{t("Couldn't load favorites.")}</p>;
  if (items.length === 0) return <p className="text-[14px] text-ink-muted">{t("This list is empty.")}</p>;

  return (
    <div className="flex flex-col gap-6">
      {hasBoth && (
        <div className="flex w-fit items-center gap-1 rounded-full bg-elevated/40 p-0.5 ring-1 ring-edge-soft/60">
          <FilterPill active={tab === "films"} onClick={() => setTab("films")}>
            {t("Movies")} <span className="ms-1 text-ink-subtle">{films.length}</span>
          </FilterPill>
          <FilterPill active={tab === "series"} onClick={() => setTab("series")}>
            {t("Shows")} <span className="ms-1 text-ink-subtle">{series.length}</span>
          </FilterPill>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-8">
        {shown.slice(0, 500).map((m, i) => (
          <PickCard key={`${m.id}-${i}`} meta={m} hideTitle />
        ))}
      </div>
    </div>
  );
}
