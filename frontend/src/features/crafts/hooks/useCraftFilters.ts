import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import type { CraftFilters } from "../types";

const FILTER_KEYS = [
  "category",
  "craft_type",
  "culture",
  "country",
  "color",
  "search",
  "place",
  "area",
  "page",
] as const;

function positiveId(value: string | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Filters live in the URL so filtered views can be shared and the back button works. */
export function useCraftFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<CraftFilters>(() => {
    const page = Number(params.get("page"));
    return {
      category: params.get("category") || undefined,
      craft_type: positiveId(params.get("craft_type")),
      culture: positiveId(params.get("culture")),
      country: params.get("country") || undefined,
      color: params.get("color") || undefined,
      place: params.get("place") || undefined,
      area: params.get("area") || undefined,
      search: params.get("search") || undefined,
      page: Number.isInteger(page) && page > 1 ? page : undefined,
    };
  }, [params]);

  const setFilters = useCallback(
    (changes: Partial<CraftFilters>) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === "" || value === null) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        if (!("page" in changes)) {
          next.delete("page");
        }
        return next;
      });
    },
    [setParams],
  );

  const clearFilters = useCallback(() => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      FILTER_KEYS.forEach((key) => next.delete(key));
      return next;
    });
  }, [setParams]);

  const hasFilters = Boolean(
    filters.category ||
    filters.craft_type ||
    filters.culture ||
    filters.country ||
    filters.color ||
    filters.area ||
    filters.search,
  );

  return { filters, setFilters, clearFilters, hasFilters };
}

/** What to say when the filters find no crafts. */
export function noMatchMessage(filters: CraftFilters) {
  if (filters.search) return `No crafts match “${filters.search}”.`;
  if (filters.place) return `No crafts found near ${filters.place}.`;
  return "No crafts match your filters.";
}

/** The searched area's corners as [south, west] and [north, east], for fitting the map. */
export function areaCorners(area: string | undefined): [number, number][] | undefined {
  const parts = area?.split(",").map(Number);
  if (!parts || parts.length !== 4 || parts.some((part) => !Number.isFinite(part)))
    return undefined;
  const [west, south, east, north] = parts;
  return [
    [south, west],
    [north, east],
  ];
}
