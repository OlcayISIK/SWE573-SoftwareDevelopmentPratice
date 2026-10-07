import { api } from "@/api/client";
import type { Paginated } from "@/api/types";

import type { Category, CraftDetail, CraftFilters, CraftListItem, CraftPin, Region } from "./types";

export const craftsApi = {
  list: (filters: CraftFilters) =>
    api.get<Paginated<CraftListItem>>("/crafts/", { params: filters }),
  pins: ({ page: _page, ...filters }: CraftFilters) =>
    api.get<CraftPin[]>("/crafts/map/", { params: filters }),
  detail: (id: number) => api.get<CraftDetail>(`/crafts/${id}/`),
  byUser: (userId: number, page = 1) =>
    api.get<Paginated<CraftListItem>>(`/users/${userId}/crafts/`, { params: { page } }),
  categories: () => api.get<Category[]>("/categories/"),
  regions: () => api.get<Region[]>("/regions/"),
};
