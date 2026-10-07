import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { refreshAccessToken } from "@/api/client";
import { session } from "@/api/session";
import { toast } from "@/lib/toast";

import { authApi } from "./api";
import { AuthContext, type AuthState } from "./context";
import type { Credentials, CurrentUser } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    session.getRefreshToken() ? { status: "loading", user: null } : { status: "guest", user: null },
  );

  useEffect(() => {
    if (state.status !== "loading") {
      return;
    }
    let cancelled = false;
    refreshAccessToken()
      .then(() => authApi.me())
      .then((user) => !cancelled && setState({ status: "authenticated", user }))
      .catch(() => !cancelled && setState({ status: "guest", user: null }));
    return () => {
      cancelled = true;
    };
    // Bootstrap runs once on load; later changes go through login and logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () =>
      session.onExpired(() => {
        queryClient.clear();
        setState({ status: "guest", user: null });
        toast.error("Your session has ended. Please log in again.");
      }),
    [queryClient],
  );

  const login = useCallback(async (credentials: Credentials) => {
    session.setTokens(await authApi.login(credentials));
    const user = await authApi.me();
    setState({ status: "authenticated", user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = session.getRefreshToken();
    if (refresh) {
      await authApi.logout(refresh).catch(() => undefined);
    }
    session.clear();
    queryClient.clear();
    setState({ status: "guest", user: null });
  }, [queryClient]);

  const setUser = useCallback((user: CurrentUser) => {
    setState({ status: "authenticated", user });
  }, []);

  const value = useMemo(
    () => ({ ...state, login, logout, setUser }),
    [state, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
