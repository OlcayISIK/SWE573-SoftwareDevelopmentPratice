import { Link } from "react-router";

import type { QueueStatus } from "../api";
import { STATUS_TABS } from "../hooks/useQueueParams";

export function StatusTabs({ basePath, status }: { basePath: string; status: QueueStatus }) {
  return (
    <nav aria-label="Report status" className="mt-6 flex flex-wrap gap-2">
      {STATUS_TABS.map(([value, label]) => (
        <Link
          key={value}
          to={value === "open" ? basePath : `${basePath}?status=${value}`}
          aria-current={status === value ? "page" : undefined}
          className={`rounded px-3 py-2 text-sm font-medium ${
            status === value ? "bg-brand-700 text-white" : "bg-white hover:bg-brand-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
