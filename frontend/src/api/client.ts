import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

import { config } from "@/lib/config";

import { ApiError, toApiError, unwrap } from "./envelope";
import { session, type TokenPair } from "./session";

export const apiClient = axios.create({ baseURL: config.apiBaseUrl });

// A separate instance, so refresh calls never go through the retry interceptor below.
const refreshClient = axios.create({ baseURL: config.apiBaseUrl });

let refreshInFlight: Promise<string> | null = null;

/**
 * Exchanges the refresh token for a new pair. Single-flight: the backend blacklists a refresh
 * token after one use, so concurrent callers must share one request instead of racing.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = session.getRefreshToken();
      if (!refresh) {
        throw new ApiError(401, "You are not signed in.");
      }
      try {
        const response = await refreshClient.post("/auth/token/refresh/", { refresh });
        const tokens = unwrap<TokenPair>(response.data);
        session.setTokens(tokens);
        return tokens.access;
      } catch (error) {
        throw toApiError(error);
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

function isAuthEndpoint(url = "") {
  return url.startsWith("/auth/");
}

apiClient.interceptors.request.use((request) => {
  const token = session.getAccessToken();
  if (token && !request.headers.Authorization) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

apiClient.interceptors.response.use(
  (response) => {
    response.data = unwrap(response.data);
    return response;
  },
  async (error) => {
    const original = error.config as RetriableConfig | undefined;
    const canRetry =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthEndpoint(original.url) &&
      session.getRefreshToken();

    if (!canRetry) {
      throw toApiError(error);
    }

    original._retried = true;
    try {
      const access = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${access}`;
      return apiClient(original);
    } catch (refreshError) {
      const failure = toApiError(refreshError);
      if (failure.status === 400 || failure.status === 401) {
        session.expire();
      }
      throw toApiError(error);
    }
  },
);

export const api = {
  async get<T>(url: string, options?: AxiosRequestConfig) {
    return (await apiClient.get<T>(url, options)).data;
  },
  async post<T>(url: string, body?: unknown, options?: AxiosRequestConfig) {
    return (await apiClient.post<T>(url, body, options)).data;
  },
  async patch<T>(url: string, body?: unknown, options?: AxiosRequestConfig) {
    return (await apiClient.patch<T>(url, body, options)).data;
  },
  async delete(url: string, options?: AxiosRequestConfig) {
    await apiClient.delete(url, options);
  },
};
