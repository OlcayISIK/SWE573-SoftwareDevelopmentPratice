import type { Schemas } from "@/api/types";

export type CraftDate = Schemas["CraftDate"];

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * A craft's date as people write it: "500 BC", "c. AD 300", "1850", or "12 March 1923". Years
 * before the common era are stored as negative numbers. Returns null when the date is unknown.
 */
export function formatCraftDate(date: CraftDate | undefined | null): string | null {
  if (!date) return null;
  if (date.kind === "day" && date.day) {
    return dayFormat.format(new Date(date.day));
  }
  if (date.kind === "year" && date.year) {
    const year = Math.abs(date.year);
    // Early years read better with their era; later ones are clear on their own.
    const text = date.year < 0 ? `${year} BC` : date.year < 1000 ? `AD ${year}` : String(year);
    return date.circa ? `c. ${text}` : text;
  }
  return null;
}
