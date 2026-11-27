import { useSearchParams } from "react-router";

import type { ProposalQueueStatus, QueueStatus } from "../api";

export const STATUS_TABS: [QueueStatus, string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["all", "All"],
];

export const PROPOSAL_TABS: [ProposalQueueStatus, string][] = [
  ["open", "Open"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["all", "All"],
];

/** The queue status in the URL, open by default, and the page number. */
export function useQueueParams<T extends string = QueueStatus>(
  tabs: [T, string][] = STATUS_TABS as [T, string][],
) {
  const [params, setParams] = useSearchParams();
  const status = (tabs.find(([value]) => value === params.get("status"))?.[0] ?? "open") as T;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (next: number) =>
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("page", String(next));
      return updated;
    });
  return { status, page, setPage };
}
