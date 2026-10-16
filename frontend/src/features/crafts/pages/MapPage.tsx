import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageLoader } from "@/components/PageLoader";
import { FavoritesPanel } from "@/features/social/components/FavoritesPanel";
import { PeoplePanel } from "@/features/social/components/PeoplePanel";

import { FilterBar } from "../components/FilterBar";
import { PinPreview } from "../components/PinPreview";
import { noMatchMessage, useCraftFilters } from "../hooks/useCraftFilters";
import { useCategories, useMapPins } from "../queries";
import type { CraftPin } from "../types";

const MapView = lazy(() => import("../components/map/MapView"));

function PinList({ pins, emptyMessage }: { pins: CraftPin[]; emptyMessage: string }) {
  const categories = useCategories();
  const categoryName = (slug: string) =>
    categories.data?.find((category) => category.slug === slug)?.name ?? slug;

  if (pins.length === 0) {
    return <p className="text-stone-700">{emptyMessage}</p>;
  }
  return (
    <ul className="divide-y divide-brand-100 rounded-lg border border-brand-100 bg-white">
      {pins.map((pin) => (
        <li key={pin.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <Link to={`/crafts/${pin.id}`} className="font-medium hover:underline">
            {pin.name}
          </Link>
          <span className="text-sm text-stone-600">{categoryName(pin.category)}</span>
        </li>
      ))}
    </ul>
  );
}

export function MapPage() {
  const { filters, setFilters, clearFilters, hasFilters } = useCraftFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const showList = searchParams.get("view") === "list";
  const pins = useMapPins(filters);
  const [selected, setSelected] = useState<number | null>(null);
  const select = useCallback((id: number) => setSelected(id), []);

  const toggleView = () =>
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (showList) {
        next.delete("view");
      } else {
        next.set("view", "list");
      }
      return next;
    });

  return (
    <>
      <h1 className="sr-only">Explore indigenous crafts on the map</h1>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />
      <div className="mx-auto grid max-w-[120rem] gap-4 px-4 py-4 lg:grid-cols-[13rem_minmax(0,1fr)_15rem] xl:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <aside aria-label="People" className="order-2 lg:order-1">
          <PeoplePanel />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-stone-700" aria-live="polite">
              {pins.data
                ? `${pins.data.length} ${pins.data.length === 1 ? "craft" : "crafts"}`
                : ""}
            </p>
            <button
              type="button"
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-brand-100"
              onClick={toggleView}
            >
              {showList ? "View on map" : "View as list"}
            </button>
          </div>
          {pins.isPending ? (
            <PageLoader label="Loading the map" />
          ) : pins.isError ? (
            <p role="alert" className="text-stone-700">
              The map could not be loaded.
            </p>
          ) : showList ? (
            <section aria-label="Crafts as a list">
              <PinList pins={pins.data} emptyMessage={noMatchMessage(filters)} />
            </section>
          ) : (
            <div className="relative aspect-[3/2] max-h-[80vh] min-h-[300px] w-full overflow-hidden rounded-lg border border-brand-100">
              <Suspense fallback={<PageLoader label="Loading the map" />}>
                <MapView pins={pins.data} onSelect={select} />
              </Suspense>
              {pins.data.length === 0 && hasFilters && (
                <div className="absolute inset-x-4 top-4 z-[1000] mx-auto w-fit max-w-full rounded-lg border border-brand-100 bg-white px-4 py-3 shadow">
                  <p>
                    {noMatchMessage(filters)}{" "}
                    <button
                      type="button"
                      className="font-medium text-brand-700 underline"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  </p>
                </div>
              )}
              {selected !== null && (
                <PinPreview craftId={selected} onClose={() => setSelected(null)} />
              )}
            </div>
          )}
        </div>

        <aside aria-label="Favorites" className="order-3">
          <FavoritesPanel />
        </aside>
      </div>
    </>
  );
}
