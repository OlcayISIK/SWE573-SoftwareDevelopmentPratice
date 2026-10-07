import { createContext, useContext } from "react";

import type { Credentials, CurrentUser } from "./types";

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: CurrentUser };

export type AuthContextValue = AuthState & {
  login: (credentials: Credentials) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  setUser: (user: CurrentUser) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNextPath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
