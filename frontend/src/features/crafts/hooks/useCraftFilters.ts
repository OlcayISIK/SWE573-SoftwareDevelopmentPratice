import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import type { CraftFilters } from "../types";

const FILTER_KEYS = ["category", "region", "search", "page"] as const;

/** Filters live in the URL so filtered views can be shared and the back button works. */
export function useCraftFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<CraftFilters>(() => {
    const region = Number(params.get("region"));
    const page = Number(params.get("page"));
    return {
      category: params.get("category") || undefined,
      region: Number.isInteger(region) && region > 0 ? region : undefined,
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

  const hasFilters = Boolean(filters.category || filters.region || filters.search);

  return { filters, setFilters, clearFilters, hasFilters };
}
