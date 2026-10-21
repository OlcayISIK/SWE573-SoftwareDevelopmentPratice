import { Link } from "react-router";

import { useUnreadCount } from "../queries";

export function NotificationBell() {
  const unread = useUnreadCount();
  const count = unread.data?.count ?? 0;
  const label = count === 0 ? "Notifications" : `Notifications, ${count} unread`;

  return (
    <Link to="/me/notifications" aria-label={label} className="btn-ghost relative px-2.5">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="animate-pop absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-amber px-1.5 text-center text-xs font-bold text-deep-sea ring-2 ring-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
