import { useEffect, useId, useState } from "react";

import { useCategories, useRegions } from "../queries";
import type { CraftFilters, Region } from "../types";

interface FilterBarProps {
  filters: CraftFilters;
  onChange: (changes: Partial<CraftFilters>) => void;
  onClear: () => void;
  hasFilters: boolean;
}

function groupByCountry(regions: Region[]) {
  const groups = new Map<string, Region[]>();
  for (const region of regions) {
    groups.set(region.country, [...(groups.get(region.country) ?? []), region]);
  }
  return [...groups.entries()];
}

const fieldClass = "mt-1 block w-full rounded border border-stone-300 bg-white px-3 py-2";

export function FilterBar({ filters, onChange, onClear, hasFilters }: FilterBarProps) {
  const id = useId();
  const categories = useCategories();
  const regions = useRegions();
  const [search, setSearch] = useState(filters.search ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => setSearch(filters.search ?? ""), [filters.search]);

  return (
    <div className="border-b border-brand-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <button
          type="button"
          className="rounded border border-stone-300 px-3 py-2 text-sm font-medium md:hidden"
          aria-expanded={open}
          aria-controls={`${id}-filters`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide filters" : "Filters"}
        </button>
        <form
          id={`${id}-filters`}
          role="search"
          aria-label="Filter crafts"
          className={`${open ? "grid" : "hidden"} mt-3 gap-3 md:mt-0 md:grid md:grid-cols-[1fr_1fr_2fr_auto] md:items-end`}
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ search: search.trim() || undefined });
          }}
        >
          <div>
            <label htmlFor={`${id}-category`} className="text-sm font-medium">
              Category
            </label>
            <select
              id={`${id}-category`}
              className={fieldClass}
              value={filters.category ?? ""}
              onChange={(event) => onChange({ category: event.target.value || undefined })}
            >
              <option value="">All categories</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-region`} className="text-sm font-medium">
              Region
            </label>
            <select
              id={`${id}-region`}
              className={fieldClass}
              value={filters.region ?? ""}
              onChange={(event) =>
                onChange({ region: event.target.value ? Number(event.target.value) : undefined })
              }
            >
              <option value="">All regions</option>
              {groupByCountry(regions.data ?? []).map(([country, items]) => (
                <optgroup key={country} label={country}>
                  {items.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-search`} className="text-sm font-medium">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`${id}-search`}
                type="search"
                className="block w-full rounded border border-stone-300 px-3 py-2"
                placeholder="Name, type, or region"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                type="submit"
                className="rounded bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-900"
              >
                Search
              </button>
            </div>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="py-2 text-sm font-medium text-brand-700 underline"
              onClick={onClear}
            >
              Clear filters
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
