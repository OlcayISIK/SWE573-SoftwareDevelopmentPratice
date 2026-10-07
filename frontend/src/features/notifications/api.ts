import { api } from "@/api/client";
import type { Paginated, Schemas } from "@/api/types";

export type AppNotification = Schemas["Notification"];

export const notificationsApi = {
  list: (page: number) =>
    api.get<Paginated<AppNotification>>("/me/notifications/", { params: { page } }),
  unreadCount: () => api.get<{ count: number }>("/me/notifications/unread-count/"),
  markRead: (ids?: number[]) =>
    api.post<{ updated: number }>("/me/notifications/read/", ids ? { ids } : {}),
};
