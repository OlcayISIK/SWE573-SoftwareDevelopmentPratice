import type { Schemas } from "@/api/types";

export type Category = Schemas["Category"];
export type Region = Schemas["Region"];
export type CraftListItem = Schemas["CraftList"];
export type CraftPin = Schemas["CraftPin"];
export type CraftDetail = Schemas["CraftDetail"];
export type CraftMedia = Schemas["Media"];

export interface CraftFilters {
  category?: string;
  region?: number;
  search?: string;
  page?: number;
}
