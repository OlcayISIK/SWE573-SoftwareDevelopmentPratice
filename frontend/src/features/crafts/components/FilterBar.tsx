import { useEffect, useId, useState } from "react";

import { useCategories, useCultures, useFacets } from "../queries";

import type { Category, CraftFilters, Facets } from "../types";

import { FacetSelect } from "./FacetSelect";

interface FilterBarProps {
  filters: CraftFilters;
  onChange: (changes: Partial<CraftFilters>) => void;
  onClear: () => void;
  hasFilters: boolean;
}

/** Craft types found in the results. A name used in two categories gets its category added. */
function craftTypeOptions(facets: Facets | undefined, categories: Category[] | undefined) {
  const types = facets?.craft_types ?? [];
  const categoryName = (id: number) => categories?.find((item) => item.id === id)?.name;
  const repeated = (name: string) => types.filter((item) => item.name === name).length > 1;
  return types.map((item) => ({
    value: String(item.id),
    label: repeated(item.name) ? `${item.name}, ${categoryName(item.category)}` : item.name,
    count: item.count,
  }));
}

export function FilterBar({ filters, onChange, onClear, hasFilters }: FilterBarProps) {
  const id = useId();
  const categories = useCategories();
  const cultures = useCultures();
  const facets = useFacets(filters).data;
  const craftTypes = craftTypeOptions(facets, categories.data);
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
          className={`${open ? "grid" : "hidden"} mt-3 gap-3 md:mt-0 md:grid md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end`}
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ search: search.trim() || undefined });
          }}
        >
          <FacetSelect
            id={`${id}-category`}
            label="Category"
            allLabel="All categories"
            value={filters.category}
            options={(facets?.categories ?? []).map((item) => ({
              value: item.slug,
              label: item.name,
              count: item.count,
            }))}
            chosenLabel={categories.data?.find((item) => item.slug === filters.category)?.name}
            // A craft type belongs to one category, so a new category clears it.
            onChange={(category) => onChange({ category, craft_type: undefined })}
          />
          <FacetSelect
            id={`${id}-craft-type`}
            label="Craft type"
            allLabel="All craft types"
            value={filters.craft_type?.toString()}
            options={craftTypes}
            onChange={(value) => onChange({ craft_type: value ? Number(value) : undefined })}
          />
          <FacetSelect
            id={`${id}-culture`}
            label="Culture"
            allLabel="All cultures"
            value={filters.culture?.toString()}
            options={(facets?.cultures ?? []).map((item) => ({
              value: String(item.id),
              label: item.name,
              count: item.count,
            }))}
            chosenLabel={cultures.data?.find((item) => item.id === filters.culture)?.name}
            onChange={(value) => onChange({ culture: value ? Number(value) : undefined })}
          />
          <FacetSelect
            id={`${id}-country`}
            label="Country"
            allLabel="All countries"
            value={filters.country}
            options={(facets?.countries ?? []).map((item) => ({
              value: item.name,
              label: item.name,
              count: item.count,
            }))}
            onChange={(country) => onChange({ country })}
          />
          <div className="md:col-span-2 lg:col-span-4">
            <label htmlFor={`${id}-search`} className="text-sm font-medium">
              Search
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`${id}-search`}
                type="search"
                className="block w-full rounded border border-stone-300 px-3 py-2"
                placeholder="Name, type, culture, or place"
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
