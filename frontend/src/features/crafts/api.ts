import { api } from "@/api/client";
import type { Paginated } from "@/api/types";

import type { CraftPayload } from "./form/schema";
import type {
  Category,
  CraftDetail,
  CraftFilters,
  CraftListItem,
  CraftMedia,
  CraftPin,
  CraftType,
  Culture,
  Facets,
  Material,
  Place,
  Tool,
} from "./types";

export type NewMedia =
  | { media_type: "photo"; file: File; alt_text: string; caption: string }
  | { media_type: "document"; file: File; caption: string }
  | { media_type: "video"; url: string; caption: string };

export function mediaBody(media: NewMedia, order: number) {
  if (media.media_type === "video") {
    return { ...media, order };
  }
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...media, order })) {
    form.append(key, value instanceof File ? value : String(value));
  }
  return form;
}

export const craftsApi = {
  list: (filters: CraftFilters) =>
    api.get<Paginated<CraftListItem>>("/crafts/", { params: filters }),
  pins: ({ page: _page, ...filters }: CraftFilters) =>
    api.get<CraftPin[]>("/crafts/map/", { params: filters }),
  detail: (id: number) => api.get<CraftDetail>(`/crafts/${id}/`),
  create: (payload: CraftPayload) => api.post<CraftDetail>("/crafts/", payload),
  update: (id: number, payload: Partial<CraftPayload>) =>
    api.patch<CraftDetail>(`/crafts/${id}/`, payload),
  remove: (id: number) => api.delete(`/crafts/${id}/`),
  addMedia: (
    craftId: number,
    media: NewMedia,
    order: number,
    onProgress?: (percent: number) => void,
  ) =>
    api.post<CraftMedia>(`/crafts/${craftId}/media/`, mediaBody(media, order), {
      onUploadProgress: (event) =>
        event.total && onProgress?.(Math.round((event.loaded / event.total) * 100)),
    }),
  removeMedia: (craftId: number, mediaId: number) =>
    api.delete(`/crafts/${craftId}/media/${mediaId}/`),
  byUser: (userId: number, page = 1) =>
    api.get<Paginated<CraftListItem>>(`/users/${userId}/crafts/`, { params: { page } }),
  categories: () => api.get<Category[]>("/categories/"),
  facets: ({ page: _page, ...filters }: CraftFilters) =>
    api.get<Facets>("/crafts/facets/", { params: filters }),
};

/** The lists the craft form picks from. Adding a name that exists returns the existing item. */
export const lookupsApi = {
  craftTypes: (category?: number) =>
    api.get<CraftType[]>("/craft-types/", { params: { category } }),
  tools: (craftType?: number) => api.get<Tool[]>("/tools/", { params: { craft_type: craftType } }),
  materials: (craftType?: number) =>
    api.get<Material[]>("/materials/", { params: { craft_type: craftType } }),
  cultures: () => api.get<Culture[]>("/cultures/"),
  addCategory: (name: string) => api.post<Category>("/categories/", { name }),
  addCraftType: (name: string, category: number) =>
    api.post<CraftType>("/craft-types/", { name, category }),
  addTool: (name: string, craftType?: number) =>
    api.post<Tool>("/tools/", { name, craft_type: craftType }),
  addMaterial: (name: string, craftType?: number) =>
    api.post<Material>("/materials/", { name, craft_type: craftType }),
  addCulture: (name: string, homeland: string) =>
    api.post<Culture>("/cultures/", { name, homeland }),
};

export const geocodeApi = {
  search: (address: string) => api.get<Place>("/geocode/search/", { params: { q: address } }),
  reverse: (latitude: number, longitude: number) =>
    api.get<Place>("/geocode/reverse/", { params: { lat: latitude, lng: longitude } }),
};
