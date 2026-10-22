import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";

import { toApiError } from "@/api/envelope";

import { geocodeApi } from "../api";
import { categoryStyle } from "../categoryStyle";
import { MAIN_COLORS } from "../mainColors";
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

/**
 * Main colors as swatches. Only the colors the results have are offered, with counts; the chosen
 * one stays listed so it can be cleared.
 */
function ColorFilter({
  name,
  value,
  counts,
  onChange,
}: {
  name: string;
  value: string | undefined;
  counts: { name: string; count: number }[];
  onChange: (color: string | undefined) => void;
}) {
  const countOf = (color: string) => counts.find((item) => item.name === color)?.count ?? 0;
  const shown = MAIN_COLORS.filter((color) => countOf(color.name) > 0 || color.name === value);
  return (
    <fieldset className="sm:col-span-3">
      <legend className="text-sm font-semibold text-deep-sea">Main color</legend>
      {shown.length === 0 ? (
        <p className="mt-1 text-sm text-stone-600">No colors are listed for these crafts.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium transition-all hover:border-brand-300 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis">
            <input
              type="radio"
              name={name}
              checked={!value}
              onChange={() => onChange(undefined)}
              className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
            />
            Any color
          </label>
          {shown.map((color) => (
            <label
              key={color.name}
              className="relative flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-brand-300 has-[:checked]:border-brand-700 has-[:checked]:bg-sky-wash has-[:checked]:text-brand-900 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis"
            >
              <input
                type="radio"
                name={name}
                checked={value === color.name}
                onChange={() => onChange(color.name)}
                className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
              />
              <span
                aria-hidden="true"
                className="h-5 w-5 rounded-full ring-1 ring-black/15"
                style={{ backgroundColor: color.swatch }}
              />
              {color.label}
              <span
                aria-hidden="true"
                className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-600"
              >
                {countOf(color.name)}
              </span>
              <span className="sr-only">
                , {countOf(color.name) === 1 ? "1 craft" : `${countOf(color.name)} crafts`}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Half the width of the area used when a place comes without one, about 1 km. */
const POINT_AREA = 0.01;

/**
 * Finds crafts near a place: the place is looked up, and its area becomes the area filter.
 * It sits inside the search form, so Enter here finds the place instead of submitting.
 */
function PlaceSearch({
  id,
  place,
  onFind,
}: {
  id: string;
  place: string | undefined;
  onFind: (place: string, area: string) => void;
}) {
  const [text, setText] = useState(place ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(place ?? ""), [place]);

  const find = async () => {
    const query = text.trim();
    if (query.length < 2) {
      setError("Enter a place to search near.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const found = await geocodeApi.search(query);
      const area = found.area ?? [
        found.longitude - POINT_AREA,
        found.latitude - POINT_AREA,
        found.longitude + POINT_AREA,
        found.latitude + POINT_AREA,
      ];
      onFind(query, area.join(","));
    } catch (failure) {
      const apiError = toApiError(failure);
      setError(apiError.status === 404 ? `We could not find “${query}”.` : apiError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-w-0 flex-[1_1_18rem] sm:max-w-sm">
      <label htmlFor={`${id}-place`} className="sr-only">
        Place
      </label>
      <div className="relative flex items-center rounded-xl bg-white shadow-md ring-1 ring-stone-200 transition-shadow focus-within:shadow-lg focus-within:ring-2 focus-within:ring-lapis/40">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-4 h-5 w-5 text-stone-500"
        />
        <input
          id={`${id}-place`}
          type="text"
          autoComplete="off"
          className="block h-14 w-full !rounded-xl !border-transparent bg-transparent pl-12 pr-24 text-base !shadow-none"
          placeholder="Near a place, such as Kadıköy"
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-place-error` : undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void find();
            }
          }}
        />
        <button
          type="button"
          disabled={pending}
          className="btn-secondary absolute right-2 h-10 px-4"
          onClick={() => void find()}
        >
          {pending ? "Finding…" : "Find"}
        </button>
      </div>
      {error && (
        <p id={`${id}-place-error`} role="alert" className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function FilterBar({ filters, onChange, onClear, hasFilters, heading }: FilterBarProps) {
  const id = useId();
  const categories = useCategories();
  const cultures = useCultures();
  const facets = useFacets(filters).data;
  const craftTypes = craftTypeOptions(facets, categories.data);
  const [search, setSearch] = useState(filters.search ?? "");
  const moreFilters = [filters.craft_type, filters.culture, filters.country, filters.color].filter(
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
            <PlaceSearch
              id={id}
              place={filters.place}
              onFind={(place, area) => onChange({ place, area })}
            />
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
            {filters.place && (
              <span className="flex h-10 items-center gap-1.5 rounded-full bg-sky-wash py-1 pl-3 pr-1 text-sm font-medium text-brand-900">
                <MapPin aria-hidden="true" className="h-4 w-4" />
                Near {filters.place}
                <button
                  type="button"
                  aria-label={`Stop searching near ${filters.place}`}
                  className="rounded-full p-1 hover:bg-white/70"
                  onClick={() => onChange({ place: undefined, area: undefined })}
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
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
            <ColorFilter
              name={`${id}-color`}
              value={filters.color}
              counts={facets?.colors ?? []}
              onChange={(color) => onChange({ color })}
            />
          </div>
        </form>
      </div>
    </section>
  );
}
