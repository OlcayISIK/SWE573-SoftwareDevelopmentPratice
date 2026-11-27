/** Whether a craft is still practiced, based on a source and set by admins. */
export type PracticeStatus = "unknown" | "living" | "endangered" | "no_longer_practiced";

export const PRACTICE_STATUS_LABELS: Record<PracticeStatus, string> = {
  unknown: "Unknown",
  living: "Living",
  endangered: "Endangered",
  no_longer_practiced: "No longer practiced",
};

export const PRACTICE_STATUS_HINTS: Record<PracticeStatus, string> = {
  unknown: "No source says yet whether it is still practiced.",
  living: "Still practiced and passed on.",
  endangered: "Practiced by few people and at risk of being lost.",
  no_longer_practiced: "Nobody practices it any more.",
};

/** The statuses a user can propose; unknown is the absence of one. */
export const PROPOSABLE_STATUSES: PracticeStatus[] = [
  "living",
  "endangered",
  "no_longer_practiced",
];

export const PRACTICE_STATUSES: PracticeStatus[] = ["unknown", ...PROPOSABLE_STATUSES];

export function isPracticeStatus(value: string | null | undefined): value is PracticeStatus {
  return PRACTICE_STATUSES.includes(value as PracticeStatus);
}
