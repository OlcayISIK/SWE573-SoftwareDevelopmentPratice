import type { Schemas } from "@/api/types";

export type Category = Schemas["Category"];
export type CraftType = Schemas["CraftType"];
export type Tool = Schemas["Tool"];
export type Material = Schemas["Material"];
export type Culture = Schemas["Culture"];
export type NamedItem = Schemas["NamedItem"];
export type Place = Schemas["Place"];
export type CraftListItem = Schemas["CraftList"];
export type CraftPin = Schemas["CraftPin"];
export type CraftDetail = Schemas["CraftDetail"];
export type CraftMedia = Schemas["Media"];

export interface CraftFilters {
  category?: string;
  craft_type?: number;
  culture?: number;
  country?: string;
  /** rrggbb, without "#". */
  color?: string;
  search?: string;
  page?: number;
}
