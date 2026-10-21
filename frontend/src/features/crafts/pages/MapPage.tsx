import { List, Map as MapIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageLoader } from "@/components/PageLoader";
import { FavoritesPanel } from "@/features/social/components/FavoritesPanel";
import { PeoplePanel } from "@/features/social/components/PeoplePanel";

import { categoryStyle } from "../categoryStyle";
import { FilterBar } from "../components/FilterBar";
import { PinPreview } from "../components/PinPreview";
import { noMatchMessage, useCraftFilters } from "../hooks/useCraftFilters";
import { useCategories, useMapPins } from "../queries";
import type { CraftPin } from "../types";

const MapView = lazy(() => import("../components/map/MapView"));

/** One pin per craft: a craft in several places has a pin for each of them. */
function uniqueCrafts(pins: CraftPin[]) {
  return pins.filter((pin, index) => pins.findIndex((other) => other.id === pin.id) === index);
}

function PinList({ pins, emptyMessage }: { pins: CraftPin[]; emptyMessage: string }) {
  const categories = useCategories();
  const categoryName = (slug: string) =>
    categories.data?.find((category) => category.slug === slug)?.name ?? slug;

  if (pins.length === 0) {
    return <p className="card p-6 text-stone-700">{emptyMessage}</p>;
  }
  return (
    <ul className="card divide-y divide-stone-100 overflow-hidden">
      {uniqueCrafts(pins).map((pin, index) => {
        const { icon: Icon, color } = categoryStyle(pin.category, pin.category_icon);
        return (
          <li
            key={pin.id}
            className="animate-fade-up flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-sky-wash/40"
            style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
          >
            <Link
              to={`/crafts/${pin.id}`}
              className="font-display text-lg font-medium hover:text-brand-700"
            >
              {pin.name}
            </Link>
            <span className="flex items-center gap-1.5 text-sm" style={{ color }}>
              <Icon aria-hidden="true" className="h-4 w-4" />
              {categoryName(pin.category)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MapPage() {
  const { filters, setFilters, clearFilters, hasFilters } = useCraftFilters();
  const [searchParams, setSearchParams] = useSearchParams();
  const showList = searchParams.get("view") === "list";
  const pins = useMapPins(filters);
  const craftCount = pins.data ? uniqueCrafts(pins.data).length : 0;
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
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasFilters={hasFilters}
        heading={
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lagoon">
              Crafts made by hand, around the world
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-deep-sea sm:text-4xl">
              Explore indigenous crafts on the map
            </h1>
          </div>
        }
      />
      <div className="mx-auto grid max-w-[120rem] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)_16rem] xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <aside aria-label="People" className="order-2 lg:order-1">
          <PeoplePanel />
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <div className="mb-3 flex items-center justify-between">
            <p
              className="rounded-full bg-white px-3 py-1 text-sm font-medium text-stone-700 shadow-sm ring-1 ring-stone-200"
              aria-live="polite"
            >
              {pins.data ? `${craftCount} ${craftCount === 1 ? "craft" : "crafts"}` : ""}
            </p>
            <button type="button" className="btn-secondary" onClick={toggleView}>
              {showList ? (
                <MapIcon aria-hidden="true" className="h-4 w-4" />
              ) : (
                <List aria-hidden="true" className="h-4 w-4" />
              )}
              {showList ? "View on map" : "View as list"}
            </button>
          </div>
          {pins.isPending ? (
            <div className="skeleton aspect-[3/2] max-h-[80vh] min-h-[300px] w-full rounded-xl">
              <PageLoader label="Loading the map" />
            </div>
          ) : pins.isError ? (
            <p role="alert" className="text-stone-700">
              The map could not be loaded.
            </p>
          ) : showList ? (
            <section aria-label="Crafts as a list">
              <PinList pins={pins.data} emptyMessage={noMatchMessage(filters)} />
            </section>
          ) : (
            <div className="relative aspect-[3/2] max-h-[80vh] min-h-[300px] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-stone-200">
              <Suspense fallback={<PageLoader label="Loading the map" />}>
                <MapView pins={pins.data} onSelect={select} />
              </Suspense>
              {pins.data.length === 0 && hasFilters && (
                <div className="animate-fade-up absolute inset-x-4 top-4 z-[1000] mx-auto w-fit max-w-full rounded-xl bg-white px-5 py-3 shadow-lg ring-1 ring-stone-200">
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
