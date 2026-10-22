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
    filters.search,
  );

  return { filters, setFilters, clearFilters, hasFilters };
}

/** What to say when the filters find no crafts. */
export function noMatchMessage(filters: CraftFilters) {
  return filters.search ? `No crafts match “${filters.search}”.` : "No crafts match your filters.";
}
