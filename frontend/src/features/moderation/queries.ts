import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { craftKeys } from "@/features/crafts/queries";

import { moderationApi, type QueueStatus } from "./api";

export const moderationKeys = {
  all: ["moderation"] as const,
  queue: (status: QueueStatus, page: number) => ["moderation", "queue", status, page] as const,
  detail: (reportId: number) => ["moderation", "report", reportId] as const,
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
