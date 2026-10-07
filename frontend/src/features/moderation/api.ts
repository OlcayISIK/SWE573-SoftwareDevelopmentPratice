import { api } from "@/api/client";
import type { Paginated, Schemas } from "@/api/types";

export type ReportReview = Schemas["ReportReview"];
export type ReportReason = "inaccurate" | "inappropriate" | "disrespectful";
export type ReviewActionType = "edit" | "hide" | "remove" | "dismiss";
export type QueueStatus = "open" | "resolved" | "dismissed" | "all";

export interface CraftTextChanges {
  name?: string;
  description?: string;
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

export type ItemReportReview = Schemas["ItemReportReview"];
export type ItemKind = "category" | "craft_type" | "tool" | "material" | "culture";
export type ItemReportReason = "duplicate" | "inaccurate" | "inappropriate";
export type ItemActionType = "rename" | "hide" | "merge" | "dismiss";

/** The lookup lists by the name their URLs use. */
export const ITEM_LISTS: Record<ItemKind, string> = {
  category: "categories",
  craft_type: "craft-types",
  tool: "tools",
  material: "materials",
  culture: "cultures",
};

export const itemModerationApi = {
  report: (kind: ItemKind, itemId: number, body: { reason: ItemReportReason; note: string }) =>
    api.post<Schemas["ItemReport"]>(`/${ITEM_LISTS[kind]}/${itemId}/report/`, body),
  queue: (status: QueueStatus, page: number) =>
    api.get<Paginated<ItemReportReview>>("/moderation/item-reports/", {
      params: { status, page },
    }),
  detail: (reportId: number) => api.get<ItemReportReview>(`/moderation/item-reports/${reportId}/`),
  review: (
    reportId: number,
    body: { action: ItemActionType; reason: string; name?: string; merge_into?: number },
  ) => api.post<ItemReportReview>(`/moderation/item-reports/${reportId}/actions/`, body),
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  category: "Category",
  craft_type: "Craft type",
  tool: "Tool",
  material: "Material",
  culture: "Culture",
};

export const ITEM_REASON_LABELS: Record<ItemReportReason, string> = {
  duplicate: "Duplicate",
  inaccurate: "Inaccurate",
  inappropriate: "Inappropriate",
};

export const ITEM_ACTION_LABELS: Record<ItemActionType, string> = {
  rename: "Rename the item",
  hide: "Hide the item",
  merge: "Merge into another item",
  dismiss: "Dismiss the report",
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
