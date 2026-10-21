import { EmptyState } from "@/components/EmptyState";
import { useEffect, useState } from "react";

import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";

import { NotificationItem } from "../components/NotificationItem";
import { useMarkAllRead, useNotifications } from "../queries";

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const notifications = useNotifications(page);
  const markAllRead = useMarkAllRead();
  const hasUnread = notifications.data?.items.some((item) => !item.is_read) ?? false;
  const { mutate: markRead, isIdle } = markAllRead;

  // Opening the list counts as reading it. The items keep their unread styling until the next visit.
  useEffect(() => {
    if (hasUnread && isIdle) {
      markRead();
    }
  }, [hasUnread, isIdle, markRead]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lagoon">Your updates</p>
      <h1 className="mt-2 text-4xl font-semibold">Notifications</h1>
      {notifications.isPending ? (
        <PageLoader label="Loading notifications" />
      ) : notifications.isError ? (
        <p role="alert" className="mt-6">
          Notifications could not be loaded.
        </p>
      ) : notifications.data.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No notifications yet.">
            Follow contributors and favorite crafts to hear about updates.
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {notifications.data.items.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}
          </ul>
          <Pagination page={page} totalPages={notifications.data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
