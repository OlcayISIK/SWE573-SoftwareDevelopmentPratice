import { http } from "msw";

import type { Category, CraftType, Culture, Place, Tool } from "@/features/crafts/types";

import { API, fail, ok } from "./http";

export const categories: Category[] = [
  {
    id: 1,
    name: "Ceramics",
    slug: "ceramics",
    icon: "amphora",
    description: "Objects shaped from clay and hardened by firing.",
    user_added: false,
  },
  {
    id: 2,
    name: "Textiles",
    slug: "textiles",
    icon: "spool",
    description: "Cloth and objects made from fibres.",
    user_added: false,
  },
];

export const craftTypes: CraftType[] = [
  {
    id: 21,
    name: "Tile",
    category: 1,
    description: "A flat piece of fired clay, usually glazed and painted.",
    user_added: false,
  },
  {
    id: 22,
    name: "Pottery",
    category: 1,
    description: "Vessels shaped from clay and fired.",
    user_added: false,
  },
  {
    id: 23,
    name: "Carpet",
    category: 2,
    description: "A pile rug made by tying rows of knots.",
    user_added: false,
  },
  {
    id: 24,
    name: "Kilim",
    category: 2,
    description: "A flat-woven rug without pile.",
    user_added: false,
  },
];

export const cultures: Culture[] = [
  {
    id: 51,
    name: "Turkish",
    homeland: "Anatolia, Türkiye",
    description: "The people of Türkiye.",
    user_added: false,
  },
  {
    id: 52,
    name: "Zapotec",
    homeland: "Oaxaca, Mexico",
    description: "An Indigenous people of Oaxaca, Mexico.",
    user_added: false,
  },
];

type Linked = Omit<Tool, "typical">;

export const tools: Linked[] = [
  {
    id: 31,
    name: "Brush",
    description: "Bristles on a handle, used to paint or glaze.",
    user_added: false,
  },
  {
    id: 32,
    name: "Kiln",
    description: "An oven that fires clay, glaze or glass.",
    user_added: false,
  },
  {
    id: 33,
    name: "Loom",
    description: "A frame that holds warp threads taut for weaving.",
    user_added: false,
  },
];

export const materials: Linked[] = [
  {
    id: 41,
    name: "Clay",
    description: "Fine earth that is soft when wet and hardens when fired.",
    user_added: false,
  },
  {
    id: 42,
    name: "Glaze",
    description: "A glassy coating fused onto ceramics in the kiln.",
    user_added: false,
  },
  { id: 43, name: "Wool", description: "Fibre shorn from sheep.", user_added: false },
];

/** Which tools and materials are typical for each craft type. */
const TYPICAL: Record<number, number[]> = { 21: [31, 32, 41, 42], 23: [33, 43] };

export const kutahya: Place = {
  latitude: 39.419923,
  longitude: 29.985743,
  address: "Kütahya, Kütahya Merkez, Aegean Region, Türkiye",
  city: "Kütahya",
  country: "Türkiye",
};

/** The list as the API returns it: typical items for the craft type first. */
export function linkedList(items: Linked[], craftType: string | null) {
  const typical = new Set(TYPICAL[Number(craftType)] ?? []);
  return items
    .map((item) => ({ ...item, typical: typical.has(item.id) }))
    .sort((a, b) => Number(b.typical) - Number(a.typical) || a.name.localeCompare(b.name));
}

/** Filter values with counts, as the facets endpoint returns them for the test crafts. */
export const facets = {
  categories: [
    { slug: "ceramics", name: "Ceramics", icon: "amphora", count: 2 },
    { slug: "textiles", name: "Textiles", icon: "spool", count: 1 },
  ],
  craft_types: [
    { id: 21, name: "Tile", category: 1, count: 2 },
    { id: 23, name: "Carpet", category: 2, count: 1 },
  ],
  cultures: [
    { id: 51, name: "Turkish", count: 2 },
    { id: 52, name: "Zapotec", count: 1 },
  ],
  countries: [
    { name: "Mexico", count: 1 },
    { name: "Türkiye", count: 2 },
  ],
};

export function emptyPage() {
  return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
}

/** Defaults every test gets: lookup lists, address lookup, and an empty map. */
export const defaultHandlers = [
  http.get(`${API}/categories/`, () => ok(categories)),
  http.get(`${API}/craft-types/`, ({ request }) => {
    const category = new URL(request.url).searchParams.get("category");
    return ok(
      category ? craftTypes.filter((item) => item.category === Number(category)) : craftTypes,
    );
  }),
  http.get(`${API}/tools/`, ({ request }) =>
    ok(linkedList(tools, new URL(request.url).searchParams.get("craft_type"))),
  ),
  http.get(`${API}/materials/`, ({ request }) =>
    ok(linkedList(materials, new URL(request.url).searchParams.get("craft_type"))),
  ),
  http.get(`${API}/cultures/`, () => ok(cultures)),
  http.get(`${API}/geocode/search/`, ({ request }) =>
    new URL(request.url).searchParams.get("q")?.includes("nowhere")
      ? fail(404, "Address not found.")
      : ok(kutahya),
  ),
  http.get(`${API}/geocode/reverse/`, () => ok(kutahya)),
  http.get(`${API}/crafts/facets/`, () => ok(facets)),
  http.get(`${API}/crafts/map/`, () => ok([])),
  http.get(`${API}/crafts/`, () => ok(emptyPage())),
  http.get(`${API}/crafts/:id/favorite/`, () => ok({ favorited: false, favorites_count: 0 })),
  http.get(`${API}/me/notifications/unread-count/`, () => ok({ count: 0 })),
  http.get(`${API}/me/favorites/`, () => ok(emptyPage())),
  http.get(`${API}/me/following/`, () => ok(emptyPage())),
  http.get(`${API}/me/followers/`, () => ok(emptyPage())),
  http.get(`${API}/users/:id/follow/`, () =>
    ok({ following: false, followers_count: 0, following_count: 0 }),
  ),
];
