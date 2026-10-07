import { api } from "@/api/client";
import type { Paginated, Schemas } from "@/api/types";

export type ReportReview = Schemas["ReportReview"];
export type ReportReason = "inaccurate" | "inappropriate" | "disrespectful";
export type ReviewActionType = "edit" | "hide" | "remove" | "dismiss";
export type QueueStatus = "open" | "resolved" | "dismissed" | "all";

export interface CraftTextChanges {
  name?: string;
  description?: string;
  production_process?: string;
  how_to_understand?: string;
  cultural_relevance?: string;
}

export const moderationApi = {
  report: (craftId: number, body: { reason: ReportReason; note: string }) =>
    api.post<Schemas["Report"]>(`/crafts/${craftId}/report/`, body),
  queue: (status: QueueStatus, page: number) =>
    api.get<Paginated<ReportReview>>("/moderation/reports/", { params: { status, page } }),
  detail: (reportId: number) => api.get<ReportReview>(`/moderation/reports/${reportId}/`),
  review: (
    reportId: number,
    body: { action: ReviewActionType; reason: string; changes?: CraftTextChanges },
  ) => api.post<ReportReview>(`/moderation/reports/${reportId}/actions/`, body),
};

export const REASON_LABELS: Record<ReportReason, string> = {
  inaccurate: "Inaccurate",
  inappropriate: "Inappropriate",
  disrespectful: "Disrespectful",
};

export const ACTION_LABELS: Record<ReviewActionType, string> = {
  edit: "Edit the craft",
  hide: "Hide the craft",
  remove: "Remove the craft",
  dismiss: "Dismiss the report",
};
