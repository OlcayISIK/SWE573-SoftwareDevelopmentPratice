import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/context";

import { notificationsApi } from "./api";

export const UNREAD_POLL_MS = 60_000;

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread"] as const,
  list: (page: number) => ["notifications", "list", page] as const,
};

/** Polled once a minute while the tab is visible; TanStack Query pauses it in background tabs. */
export function useUnreadCount() {
  const auth = useAuth();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unreadCount,
    enabled: auth.status === "authenticated",
    refetchInterval: UNREAD_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useNotifications(page: number) {
  return useQuery({
    queryKey: notificationKeys.list(page),
    queryFn: () => notificationsApi.list(page),
    placeholderData: keepPreviousData,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markRead(),
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unread, { count: 0 });
    },
  });
}
