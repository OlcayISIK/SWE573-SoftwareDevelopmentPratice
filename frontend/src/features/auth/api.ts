import { api } from "@/api/client";
import type { TokenPair } from "@/api/session";

import type { Credentials, CurrentUser } from "./types";

export interface RegisterBody {
  email: string;
  password: string;
  display_name?: string;
}

export interface AccountSummary {
  id: number;
  email: string;
  is_email_verified: boolean;
}

export const authApi = {
  register: (body: RegisterBody) => api.post<AccountSummary>("/auth/register/", body),
  verifyEmail: (body: { uid: string; token: string }) =>
    api.post<AccountSummary>("/auth/verify-email/", body),
  resendVerification: (email: string) =>
    api.post<{ detail: string }>("/auth/verify-email/resend/", { email }),
  login: (credentials: Credentials) => api.post<TokenPair>("/auth/token/", credentials),
  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),
  me: () => api.get<CurrentUser>("/me/"),
  requestPasswordReset: (email: string) =>
    api.post<{ detail: string }>("/auth/password-reset/", { email }),
  confirmPasswordReset: (body: { uid: string; token: string; new_password: string }) =>
    api.post<{ detail: string }>("/auth/password-reset/confirm/", body),
};
