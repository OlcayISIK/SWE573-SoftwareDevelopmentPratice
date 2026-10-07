export interface TokenPair {
  access: string;
  refresh: string;
}

const REFRESH_KEY = "ic.refresh";

let accessToken: string | null = null;
const expiredListeners = new Set<() => void>();

function readRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/**
 * The access token lives only in memory. The refresh token is kept in localStorage so the
 * session survives a reload; see "Authentication" in FRONTEND_ARCHITECTURE.md for the tradeoff.
 */
export const session = {
  getAccessToken: () => accessToken,
  getRefreshToken: readRefreshToken,
  hasSession: () => Boolean(accessToken || readRefreshToken()),

  setTokens({ access, refresh }: TokenPair) {
    accessToken = access;
    try {
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // Storage can be unavailable (private mode); the session then lasts until reload.
    }
  },

  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // Nothing to clear.
    }
  },

  /** Ends the session after a failed refresh and tells listeners (the auth provider). */
  expire() {
    session.clear();
    expiredListeners.forEach((listener) => listener());
  },

  onExpired(listener: () => void) {
    expiredListeners.add(listener);
    return () => {
      expiredListeners.delete(listener);
    };
  },
};
