import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { craftsApi, lookupsApi, type NewMedia } from "./api";
import type { CraftFilters } from "./types";

export const craftKeys = {
  all: ["crafts"] as const,
  lists: () => [...craftKeys.all, "list"] as const,
  list: (filters: CraftFilters) => [...craftKeys.lists(), filters] as const,
  pins: (filters: CraftFilters) => [...craftKeys.all, "pins", filters] as const,
  detail: (id: number) => [...craftKeys.all, "detail", id] as const,
  byUser: (userId: number, page: number) => [...craftKeys.all, "user", userId, page] as const,
  categories: ["reference", "categories"] as const,
  countries: ["reference", "countries"] as const,
};

export const lookupKeys = {
  all: ["reference"] as const,
  craftTypes: (category: number) => ["reference", "craft-types", category] as const,
  allCraftTypes: ["reference", "craft-types", "all"] as const,
  tools: (craftType: number | null) => ["reference", "tools", craftType] as const,
  materials: (craftType: number | null) => ["reference", "materials", craftType] as const,
  cultures: ["reference", "cultures"] as const,
};

export function useCraftList(filters: CraftFilters) {
  return useQuery({
    queryKey: craftKeys.list(filters),
    queryFn: () => craftsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useMapPins(filters: CraftFilters) {
  return useQuery({
    queryKey: craftKeys.pins(filters),
    queryFn: () => craftsApi.pins(filters),
    staleTime: 60_000,
  });
}

export function useCraft(id: number | null) {
  return useQuery({
    queryKey: craftKeys.detail(id ?? 0),
    queryFn: () => craftsApi.detail(id as number),
    enabled: id !== null,
  });
}

export function useDeleteCraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => craftsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: craftKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: craftKeys.all });
    },
  });
}

export function useUpdateCraft(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof craftsApi.update>[1]) => craftsApi.update(id, payload),
    onSuccess: (craft) => {
      queryClient.setQueryData(craftKeys.detail(id), craft);
      return queryClient.invalidateQueries({ queryKey: craftKeys.all });
    },
  });
}

export function useMediaMutations(craftId: number) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: craftKeys.all });
  return {
    add: useMutation({
      mutationFn: ({ media, order }: { media: NewMedia; order: number }) =>
        craftsApi.addMedia(craftId, media, order),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (mediaId: number) => craftsApi.removeMedia(craftId, mediaId),
      onSuccess: refresh,
    }),
  };
}

export function useUserCrafts(userId: number, page: number) {
  return useQuery({
    queryKey: craftKeys.byUser(userId, page),
    queryFn: () => craftsApi.byUser(userId, page),
    placeholderData: keepPreviousData,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: craftKeys.categories,
    queryFn: craftsApi.categories,
    staleTime: Infinity,
  });
}

export function useCraftTypes(category: number | null) {
  return useQuery({
    queryKey: lookupKeys.craftTypes(category ?? 0),
    queryFn: () => lookupsApi.craftTypes(category as number),
    enabled: category !== null,
    staleTime: 5 * 60_000,
  });
}

/** Every craft type, for picking one regardless of category. */
export function useAllCraftTypes(enabled = true) {
  return useQuery({
    queryKey: lookupKeys.allCraftTypes,
    queryFn: () => lookupsApi.craftTypes(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: craftKeys.countries,
    queryFn: craftsApi.countries,
    staleTime: 5 * 60_000,
  });
}

export function useTools(craftType: number | null) {
  return useQuery({
    queryKey: lookupKeys.tools(craftType),
    queryFn: () => lookupsApi.tools(craftType ?? undefined),
    staleTime: 5 * 60_000,
  });
}

export function useMaterials(craftType: number | null) {
  return useQuery({
    queryKey: lookupKeys.materials(craftType),
    queryFn: () => lookupsApi.materials(craftType ?? undefined),
    staleTime: 5 * 60_000,
  });
}

export function useCultures() {
  return useQuery({
    queryKey: lookupKeys.cultures,
    queryFn: lookupsApi.cultures,
    staleTime: 5 * 60_000,
  });
}

/**
 * Adds an item to a lookup list. The lists are refreshed so the new item can be picked at once,
 * by everyone on this page and later visitors.
 */
export function useAddLookup<Args extends unknown[], Item>(add: (...args: Args) => Promise<Item>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: Args) => add(...args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lookupKeys.all }),
  });
}
