import { useSearchParams } from "react-router";

import type { QueueStatus } from "../api";

export const STATUS_TABS: [QueueStatus, string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["all", "All"],
];

/** The queue status in the URL, open by default, and the page number. */
export function useQueueParams() {
  const [params, setParams] = useSearchParams();
  const status = (STATUS_TABS.find(([value]) => value === params.get("status"))?.[0] ??
    "open") as QueueStatus;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (next: number) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("page", String(next));
      return updated;
    });
  return { status, page, setPage };
}
