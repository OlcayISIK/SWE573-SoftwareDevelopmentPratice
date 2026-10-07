import { useEffect, useId, useState } from "react";

import { useCategories, useCountries, useCraftTypes, useCultures } from "../queries";
import type { CraftFilters } from "../types";

interface FilterBarProps {
  filters: CraftFilters;
  onChange: (changes: Partial<CraftFilters>) => void;
  onClear: () => void;
  hasFilters: boolean;
}

const fieldClass = "mt-1 block w-full rounded border border-stone-300 bg-white px-3 py-2";

export function FilterBar({ filters, onChange, onClear, hasFilters }: FilterBarProps) {
  const id = useId();
  const categories = useCategories();
  const categoryId = categories.data?.find((item) => item.slug === filters.category)?.id ?? null;
  const craftTypes = useCraftTypes(categoryId);
  const cultures = useCultures();
  const countries = useCountries();
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
          className={`${open ? "grid" : "hidden"} mt-3 gap-3 md:mt-0 md:grid md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,2fr)_auto] md:items-end`}
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
              onChange={(event) =>
                // A craft type belongs to one category, so a new category clears it.
                onChange({ category: event.target.value || undefined, craft_type: undefined })
              }
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
            <label htmlFor={`${id}-craft-type`} className="text-sm font-medium">
              Craft type
            </label>
            <select
              id={`${id}-craft-type`}
              className={fieldClass}
              disabled={!categoryId}
              value={filters.craft_type ?? ""}
              onChange={(event) =>
                onChange({ craft_type: Number(event.target.value) || undefined })
              }
            >
              <option value="">{categoryId ? "All craft types" : "Choose a category first"}</option>
              {craftTypes.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-culture`} className="text-sm font-medium">
              Culture
            </label>
            <select
              id={`${id}-culture`}
              className={fieldClass}
              value={filters.culture ?? ""}
              onChange={(event) => onChange({ culture: Number(event.target.value) || undefined })}
            >
              <option value="">All cultures</option>
              {cultures.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-country`} className="text-sm font-medium">
              Country
            </label>
            <select
              id={`${id}-country`}
              className={fieldClass}
              value={filters.country ?? ""}
              onChange={(event) => onChange({ country: event.target.value || undefined })}
            >
              <option value="">All countries</option>
              {countries.data?.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
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
