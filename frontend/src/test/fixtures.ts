import { http } from "msw";

import type { CurrentUser } from "@/features/auth/types";

import { API, ok } from "./http";

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
