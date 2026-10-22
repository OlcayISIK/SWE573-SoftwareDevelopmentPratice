import { Search, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

import { categoryStyle } from "../categoryStyle";
import { useCategories, useCultures, useFacets } from "../queries";
import type { Category, CraftFilters, Facets } from "../types";

import { FacetSelect } from "./FacetSelect";

interface FilterBarProps {
  filters: CraftFilters;
  onChange: (changes: Partial<CraftFilters>) => void;
  onClear: () => void;
  hasFilters: boolean;
  /** The page heading, shown above the search. */
  heading?: ReactNode;
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

interface ChipProps {
  name: string;
  checked: boolean;
  label: string;
  count?: number;
  slug?: string;
  icon?: string;
  onSelect: () => void;
}

/** A category as a chip: a real radio button underneath, so it works with keys and readers. */
function CategoryChip({ name, checked, label, count, slug, icon, onSelect }: ChipProps) {
  const { icon: Icon, color } = categoryStyle(slug, icon);
  return (
    <label
      className={`relative flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis ${
        checked
          ? "border-brand-700 bg-brand-700 text-white shadow-md"
          : "border-stone-200 bg-white text-stone-800 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"
      }`}
    >
      <input
        type="radio"
        name={name}
        className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
        checked={checked}
        onChange={onSelect}
      />
      {slug !== undefined && (
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
          style={{ color: checked ? "currentColor" : color }}
        />
      )}
      {label}
      {count !== undefined && (
        <>
          <span
            aria-hidden="true"
            className={`rounded-full px-1.5 text-xs ${
              checked ? "bg-white/20" : "bg-stone-100 text-stone-600"
            }`}
          >
            {count}
          </span>
          <span className="sr-only">, {count === 1 ? "1 craft" : `${count} crafts`}</span>
        </>
      )}
    </label>
  );
}

export function FilterBar({ filters, onChange, onClear, hasFilters, heading }: FilterBarProps) {
  const id = useId();
  const categories = useCategories();
  const cultures = useCultures();
  const facets = useFacets(filters).data;
  const craftTypes = craftTypeOptions(facets, categories.data);
  const [search, setSearch] = useState(filters.search ?? "");
  const moreFilters = [filters.craft_type, filters.culture, filters.country].filter(
    (value) => value !== undefined,
  ).length;
  const [open, setOpen] = useState(moreFilters > 0);

  useEffect(() => setSearch(filters.search ?? ""), [filters.search]);

  const categoryFacets = facets?.categories ?? [];
  // Keep the chosen category listed so it stays visible, even when the results no longer have it.
  const chosenMissing =
    filters.category && !categoryFacets.some((item) => item.slug === filters.category);
  const categoryChips = chosenMissing
    ? [
        ...categoryFacets,
        {
          slug: filters.category!,
          icon: categories.data?.find((item) => item.slug === filters.category)?.icon ?? "",
          name:
            categories.data?.find((item) => item.slug === filters.category)?.name ??
            filters.category!,
          count: 0,
        },
      ]
    : categoryFacets;

  return (
    <section className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-b from-white to-mist">
      <div aria-hidden="true" className="bg-contour animate-drift absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-6">
        {heading}
        <form
          role="search"
          aria-label="Filter crafts"
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ search: search.trim() || undefined });
          }}
        >
          <label htmlFor={`${id}-search`} className="sr-only">
            Search
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex min-w-0 max-w-3xl flex-[1_1_26rem] items-center rounded-xl bg-white shadow-md ring-1 ring-stone-200 transition-shadow focus-within:shadow-lg focus-within:ring-2 focus-within:ring-lapis/40">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 h-5 w-5 text-stone-500"
              />
              <input
                id={`${id}-search`}
                type="search"
                className="block h-14 w-full !rounded-xl !border-transparent bg-transparent pl-12 pr-32 text-base !shadow-none"
                placeholder="Search by name, culture, place, material, or pattern"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button type="submit" className="btn-primary absolute right-2 h-10 px-5">
                Search
              </button>
            </div>
            <button
              type="button"
              className={`btn h-14 px-5 ${open ? "bg-sky-wash text-brand-900" : "border border-stone-200 bg-white text-stone-800 hover:border-brand-300"}`}
              aria-expanded={open}
              aria-controls={`${id}-more`}
              onClick={() => setOpen((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {open ? "Hide filters" : "Filters"}
              {moreFilters > 0 && (
                <span
                  aria-hidden="true"
                  className="rounded-full bg-brand-700 px-1.5 text-xs font-bold text-white"
                >
                  {moreFilters}
                </span>
              )}
            </button>
            {hasFilters && (
              <button type="button" className="btn-ghost h-14" onClick={onClear}>
                <X aria-hidden="true" className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <fieldset className="min-w-0 flex-1">
              <legend className="sr-only">Category</legend>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
                <CategoryChip
                  name={`${id}-category`}
                  checked={!filters.category}
                  label="All categories"
                  onSelect={() => onChange({ category: undefined, craft_type: undefined })}
                />
                {categoryChips.map((item) => (
                  <CategoryChip
                    key={item.slug}
                    name={`${id}-category`}
                    checked={filters.category === item.slug}
                    label={item.name}
                    count={item.count}
                    slug={item.slug}
                    icon={item.icon}
                    // A craft type belongs to one category, so a new category clears it.
                    onSelect={() => onChange({ category: item.slug, craft_type: undefined })}
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <div
            id={`${id}-more`}
            className={`${open ? "grid" : "hidden"} animate-fade-up mt-3 gap-3 rounded-xl border border-stone-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:grid-cols-3`}
          >
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
          </div>
        </form>
      </div>
    </section>
  );
}
