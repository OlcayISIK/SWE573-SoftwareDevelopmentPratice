import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { craftsApi, lookupsApi } from "@/features/crafts/api";
import { craftKeys, lookupKeys } from "@/features/crafts/queries";

import { itemModerationApi, moderationApi, type ItemKind, type QueueStatus } from "./api";

export const moderationKeys = {
  all: ["moderation"] as const,
  queue: (status: QueueStatus, page: number) => ["moderation", "queue", status, page] as const,
  detail: (reportId: number) => ["moderation", "report", reportId] as const,
  itemQueue: (status: QueueStatus, page: number) =>
    ["moderation", "item-queue", status, page] as const,
  itemDetail: (reportId: number) => ["moderation", "item-report", reportId] as const,
};

export function useReviewQueue(status: QueueStatus, page: number) {
  return useQuery({
    queryKey: moderationKeys.queue(status, page),
    queryFn: () => moderationApi.queue(status, page),
    placeholderData: keepPreviousData,
  });
}

export function useReport(reportId: number | null) {
  return useQuery({
    queryKey: moderationKeys.detail(reportId ?? 0),
    queryFn: () => moderationApi.detail(reportId as number),
    enabled: reportId !== null,
  });
}

export function useReviewReport(reportId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof moderationApi.review>[1]) =>
      moderationApi.review(reportId, body),
    onSuccess: (report) => {
      queryClient.setQueryData(moderationKeys.detail(reportId), report);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: moderationKeys.all }),
        queryClient.invalidateQueries({ queryKey: craftKeys.all }),
      ]);
    },
  });
}

export function useItemReviewQueue(status: QueueStatus, page: number) {
  return useQuery({
    queryKey: moderationKeys.itemQueue(status, page),
    queryFn: () => itemModerationApi.queue(status, page),
    placeholderData: keepPreviousData,
  });
}

export function useItemReport(reportId: number | null) {
  return useQuery({
    queryKey: moderationKeys.itemDetail(reportId ?? 0),
    queryFn: () => itemModerationApi.detail(reportId as number),
    enabled: reportId !== null,
  });
}

export function useReviewItemReport(reportId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof itemModerationApi.review>[1]) =>
      itemModerationApi.review(reportId, body),
    onSuccess: (report) => {
      queryClient.setQueryData(moderationKeys.itemDetail(reportId), report);
      // A rename, hide, or merge changes the lists and the crafts that use the item.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: moderationKeys.all }),
        queryClient.invalidateQueries({ queryKey: lookupKeys.all }),
        queryClient.invalidateQueries({ queryKey: craftKeys.all }),
      ]);
    },
  });
}

async function mergeTargets(kind: ItemKind) {
  switch (kind) {
    case "category":
      return craftsApi.categories();
    case "craft_type": {
      // Craft types merge only within their category, so the category is part of the label.
      const [craftTypes, categories] = await Promise.all([
        lookupsApi.craftTypes(),
        craftsApi.categories(),
      ]);
      const categoryName = new Map(categories.map((category) => [category.id, category.name]));
      return craftTypes.map((craftType) => ({
        id: craftType.id,
        name: `${craftType.name} (${categoryName.get(craftType.category) ?? "no category"})`,
      }));
    }
    case "tool":
      return lookupsApi.tools();
    case "material":
      return lookupsApi.materials();
    case "culture":
      return lookupsApi.cultures();
  }
}

/** The visible items of a kind, which a reported item can be merged into. */
export function useMergeTargets(kind: ItemKind, enabled: boolean) {
  return useQuery({
    queryKey: [...lookupKeys.all, "merge-targets", kind],
    queryFn: async () => (await mergeTargets(kind)).map(({ id, name }) => ({ id, name })),
    enabled,
  });
}
