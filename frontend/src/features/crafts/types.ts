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
export type Facets = Schemas["Facets"];

export interface CraftFilters {
  category?: string;
  craft_type?: number;
  culture?: number;
  country?: string;
  /** A main color, such as "red". */
  color?: string;
  search?: string;
  /** The place searched near, as the user typed it, such as "Kadıköy". */
  place?: string;
  /** That place's area as "west,south,east,north"; crafts with a place inside it are found. */
  area?: string;
  page?: number;
}
