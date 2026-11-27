import type { Schemas } from "@/api/types";
import type { PracticeStatus } from "./practiceStatus";

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
export type CraftStory = Schemas["Story"];
export type Facets = Schemas["Facets"];
export type WikidataItem = Schemas["WikidataItem"];
export type SearchTerm = Schemas["SearchTerm"];

export interface CraftFilters {
  category?: string;
  craft_type?: number;
  culture?: number;
  country?: string;
  /** A main color, such as "red". */
  color?: string;
  /** Whether the craft is still practiced, such as "endangered". */
  practice_status?: PracticeStatus;
  search?: string;
  /** Search only the words as typed, not other names of the items they name. */
  exact?: boolean;
  /** The place searched near, as the user typed it, such as "Kadıköy". */
  place?: string;
  /** That place's area as "west,south,east,north"; crafts with a place inside it are found. */
  area?: string;
  page?: number;
}
