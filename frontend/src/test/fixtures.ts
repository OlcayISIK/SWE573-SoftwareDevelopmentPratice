import { http } from "msw";

import type { CurrentUser } from "@/features/auth/types";
import type { CraftDetail, CraftListItem } from "@/features/crafts/types";

import { categories, regions } from "./handlers";
import { API, ok } from "./http";

export function makeCraftListItem(overrides: Partial<CraftListItem> = {}): CraftListItem {
  return {
    id: 1,
    name: "Kütahya Çinisi",
    craft_type: "Tile",
    category: categories[0],
    region: regions[0],
    latitude: 39.42,
    longitude: 29.98,
    cover_photo: { url: "http://localhost:8000/media/crafts/1/a.png", alt_text: "Blue tile" },
    status: "published",
    author: { id: 7, display_name: "Ayşe" },
    created_at: "2026-10-05T10:00:00Z",
    ...overrides,
  } as CraftListItem;
}

export function makeCraftDetail(overrides: Partial<CraftDetail> = {}): CraftDetail {
  return {
    id: 1,
    name: "Kütahya Çinisi",
    craft_type: "Tile",
    category: categories[0],
    region: regions[0],
    latitude: 39.42,
    longitude: 29.98,
    media: [
      {
        id: 100,
        media_type: "photo",
        file: "http://localhost:8000/media/crafts/1/a.png",
        url: "",
        caption: "Front",
        alt_text: "Blue tile with floral motifs",
        order: 0,
      },
    ],
    description: "Hand-painted glazed tiles.",
    production_process: "Shaped, painted, glazed, and fired.",
    how_to_understand: "Floral motifs and cobalt blue are typical.",
    cultural_relevance: "A living Anatolian tradition.",
    attributes: {},
    status: "published",
    author: { id: 7, display_name: "Ayşe" },
    created_at: "2026-10-05T10:00:00Z",
    updated_at: "2026-10-05T10:00:00Z",
    ...overrides,
  } as CraftDetail;
}

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 7,
    email: "ayse@example.com",
    role: "user",
    is_email_verified: true,
    display_name: "Ayşe",
    bio: "",
    city: "İstanbul",
    country: "Türkiye",
    avatar: null as unknown as string,
    show_email: false,
    date_joined: "2026-10-01T10:00:00Z",
    ...overrides,
  } as CurrentUser;
}

/** Handlers for a signed-in session restored from a stored refresh token. */
export function sessionHandlers(user: CurrentUser = makeUser()) {
  return [
    http.post(`${API}/auth/token/refresh/`, () => ok({ access: "access-1", refresh: "refresh-2" })),
    http.get(`${API}/me/`, () => ok(user)),
  ];
}

export function signedIn(user?: CurrentUser) {
  localStorage.setItem("ic.refresh", "refresh-1");
  return sessionHandlers(user);
}
