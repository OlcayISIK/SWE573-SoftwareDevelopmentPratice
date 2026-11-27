import { Link } from "react-router";

import type { QueueStatus } from "../api";
import { STATUS_TABS } from "../hooks/useQueueParams";

export function StatusTabs<T extends string = QueueStatus>({
  basePath,
  status,
  tabs = STATUS_TABS as [T, string][],
  label = "Report status",
}: {
  basePath: string;
  status: T;
  tabs?: [T, string][];
  label?: string;
}) {
  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap gap-2">
      {tabs.map(([value, label]) => (
        <Link
          key={value}
          to={value === "open" ? basePath : `${basePath}?status=${value}`}
          aria-current={status === value ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            status === value
              ? "bg-brand-700 text-white shadow-md"
              : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-brand-300"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
