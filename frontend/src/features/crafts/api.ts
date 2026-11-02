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
  CraftStory,
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

/** Stories other users share about a craft; the craft's author tells theirs in the craft. */
export const storiesApi = {
  list: (craftId: number, { page = 1, author }: { page?: number; author?: number } = {}) =>
    api.get<Paginated<CraftStory>>(`/crafts/${craftId}/stories/`, { params: { page, author } }),
  share: (craftId: number, text: string) =>
    api.post<CraftStory>(`/crafts/${craftId}/stories/`, { text }),
  edit: (craftId: number, storyId: number, text: string) =>
    api.patch<CraftStory>(`/crafts/${craftId}/stories/${storyId}/`, { text }),
  remove: (craftId: number, storyId: number) =>
    api.delete(`/crafts/${craftId}/stories/${storyId}/`),
};

/** The lists the craft form picks from. Adding a name that exists returns the existing item. */
export const lookupsApi = {
  craftTypes: (category?: number) =>
    api.get<CraftType[]>("/craft-types/", { params: { category } }),
  tools: (craftType?: number) => api.get<Tool[]>("/tools/", { params: { craft_type: craftType } }),
  materials: (craftType?: number) =>
    api.get<Material[]>("/materials/", { params: { craft_type: craftType } }),
  cultures: () => api.get<Culture[]>("/cultures/"),
  addCategory: (name: string, description = "", icon = "sparkles") =>
    api.post<Category>("/categories/", { name, description, icon }),
  addCraftType: (name: string, category: number, description = "") =>
    api.post<CraftType>("/craft-types/", { name, category, description }),
  addTool: (name: string, craftType?: number, description = "") =>
    api.post<Tool>("/tools/", { name, craft_type: craftType, description }),
  addMaterial: (name: string, craftType?: number, description = "") =>
    api.post<Material>("/materials/", { name, craft_type: craftType, description }),
  addCulture: (name: string, homeland: string, description = "") =>
    api.post<Culture>("/cultures/", { name, homeland, description }),
};

export const geocodeApi = {
  search: (address: string) => api.get<Place>("/geocode/search/", { params: { q: address } }),
  reverse: (latitude: number, longitude: number) =>
    api.get<Place>("/geocode/reverse/", { params: { lat: latitude, lng: longitude } }),
};
