import { lazy, Suspense, useCallback, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { PageLoader } from "@/components/PageLoader";

import { FilterBar } from "../components/FilterBar";
import { PinPreview } from "../components/PinPreview";
import { useCraftFilters } from "../hooks/useCraftFilters";
import { useCategories, useMapPins } from "../queries";
import type { CraftPin } from "../types";

const MapView = lazy(() => import("../components/map/MapView"));

function PinList({ pins }: { pins: CraftPin[] }) {
  const categories = useCategories();
  const categoryName = (slug: string) =>
    categories.data?.find((category) => category.slug === slug)?.name ?? slug;

  if (pins.length === 0) {
    return <p className="text-stone-700">No crafts match your filters.</p>;
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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <p className="text-sm text-stone-700" aria-live="polite">
          {pins.data ? `${pins.data.length} ${pins.data.length === 1 ? "craft" : "crafts"}` : ""}
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
        <p role="alert" className="mx-auto max-w-6xl px-4 text-stone-700">
          The map could not be loaded.
        </p>
      ) : showList ? (
        <section aria-label="Crafts as a list" className="mx-auto max-w-6xl px-4 pb-10">
          <PinList pins={pins.data} />
        </section>
      ) : (
        <div className="relative h-[70vh] min-h-[420px]">
          <Suspense fallback={<PageLoader label="Loading the map" />}>
            <MapView pins={pins.data} onSelect={select} />
          </Suspense>
          {selected !== null && <PinPreview craftId={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </>
  );
}
