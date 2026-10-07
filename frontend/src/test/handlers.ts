import { http } from "msw";

import type { Category, Region } from "@/features/crafts/types";

import { API, ok } from "./http";

export const categories: Category[] = [
  { id: 1, name: "Ceramics", slug: "ceramics" },
  { id: 2, name: "Textiles", slug: "textiles" },
];

export const regions: Region[] = [
  {
    id: 10,
    name: "Kütahya",
    country: "Türkiye",
    description: "Western Anatolian province known for glazed tiles.",
  },
  { id: 11, name: "Uşak", country: "Türkiye", description: "Known for hand-knotted carpets." },
  { id: 12, name: "Oaxaca", country: "Mexico", description: "Known for black pottery." },
];

export function emptyPage() {
  return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
}

/** Defaults every test gets: reference data and an empty map. Tests override with server.use. */
export const defaultHandlers = [
  http.get(`${API}/categories/`, () => ok(categories)),
  http.get(`${API}/regions/`, () => ok(regions)),
  http.get(`${API}/crafts/map/`, () => ok([])),
  http.get(`${API}/crafts/`, () => ok(emptyPage())),
];
