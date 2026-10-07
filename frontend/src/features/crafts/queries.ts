import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { craftsApi, type NewMedia } from "./api";
import type { CraftFilters } from "./types";

export const craftKeys = {
  all: ["crafts"] as const,
  lists: () => [...craftKeys.all, "list"] as const,
  list: (filters: CraftFilters) => [...craftKeys.lists(), filters] as const,
  pins: (filters: CraftFilters) => [...craftKeys.all, "pins", filters] as const,
  detail: (id: number) => [...craftKeys.all, "detail", id] as const,
  byUser: (userId: number, page: number) => [...craftKeys.all, "user", userId, page] as const,
  categories: ["reference", "categories"] as const,
  regions: ["reference", "regions"] as const,
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

export function useRegions() {
  return useQuery({ queryKey: craftKeys.regions, queryFn: craftsApi.regions, staleTime: Infinity });
}
