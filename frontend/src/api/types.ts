import type { components } from "./schema";

export type Schemas = components["schemas"];

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
