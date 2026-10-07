import { api } from "@/api/client";
import type { TokenPair } from "@/api/session";

import type { Credentials, CurrentUser } from "./types";

export const authApi = {
  login: (credentials: Credentials) => api.post<TokenPair>("/auth/token/", credentials),
  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),
  me: () => api.get<CurrentUser>("/me/"),
  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>("/auth/password-reset/", { email }),
  confirmPasswordReset: (body: { uid: string; token: string; new_password: string }) =>
    api.post<{ detail: string }>("/auth/password-reset/confirm/", body),
};
