import { http, HttpResponse } from "msw";

import { API, fail, ok } from "@/test/http";
import { server } from "@/test/server";

import { api } from "./client";
import { ApiError } from "./envelope";
import { session } from "./session";

function protectedEndpoint(validToken: string) {
  return http.get(`${API}/protected/`, ({ request }) =>
    request.headers.get("Authorization") === `Bearer ${validToken}`
      ? ok({ secret: 42 })
      : fail(401, "Given token not valid for any token type"),
  );
}

test("unwraps the response envelope", async () => {
  server.use(http.get(`${API}/thing/`, () => ok({ name: "Kilim" })));

  await expect(api.get("/thing/")).resolves.toEqual({ name: "Kilim" });
});

test("sends the access token", async () => {
  session.setTokens({ access: "valid", refresh: "r1" });
  server.use(protectedEndpoint("valid"));

  await expect(api.get("/protected/")).resolves.toEqual({ secret: 42 });
});

test("turns error envelopes into ApiError with flattened field errors", async () => {
  server.use(
    http.post(`${API}/thing/`, () =>
      fail(400, "Validation failed.", {
        name: ["This field is required."],
        changes: { latitude: ["Ensure this value is less than or equal to 90."] },
      }),
    ),
  );

  const error = await api.post("/thing/", {}).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(400);
  expect((error as ApiError).message).toBe("Validation failed.");
  expect((error as ApiError).fieldErrors).toEqual({
    name: ["This field is required."],
    "changes.latitude": ["Ensure this value is less than or equal to 90."],
  });
});

test("network failures become ApiError with status 0", async () => {
  server.use(http.get(`${API}/thing/`, () => HttpResponse.error()));

  const error = (await api.get("/thing/").catch((e: unknown) => e)) as ApiError;

  expect(error.isNetworkError).toBe(true);
});

test("an expired access token is refreshed once and the request retried", async () => {
  session.setTokens({ access: "expired", refresh: "r1" });
  let refreshCalls = 0;
  server.use(
    protectedEndpoint("new-access"),
    http.post(`${API}/auth/token/refresh/`, async ({ request }) => {
      refreshCalls += 1;
      const body = (await request.json()) as { refresh: string };
      expect(body.refresh).toBe("r1");
      return ok({ access: "new-access", refresh: "r2" });
    }),
  );

  await expect(api.get("/protected/")).resolves.toEqual({ secret: 42 });
  expect(refreshCalls).toBe(1);
  expect(session.getRefreshToken()).toBe("r2");
});

test("concurrent 401 responses share a single refresh call", async () => {
  session.setTokens({ access: "expired", refresh: "r1" });
  let refreshCalls = 0;
  server.use(
    protectedEndpoint("new-access"),
    http.post(`${API}/auth/token/refresh/`, async () => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return ok({ access: "new-access", refresh: "r2" });
    }),
  );

  const results = await Promise.all([
    api.get("/protected/"),
    api.get("/protected/"),
    api.get("/protected/"),
  ]);

  expect(results).toEqual([{ secret: 42 }, { secret: 42 }, { secret: 42 }]);
  expect(refreshCalls).toBe(1);
});

test("a rejected refresh ends the session", async () => {
  session.setTokens({ access: "expired", refresh: "blacklisted" });
  const onExpired = vi.fn();
  const unsubscribe = session.onExpired(onExpired);
  server.use(
    protectedEndpoint("never"),
    http.post(`${API}/auth/token/refresh/`, () => fail(401, "Token is blacklisted")),
  );

  const error = (await api.get("/protected/").catch((e: unknown) => e)) as ApiError;
  unsubscribe();

  expect(error.status).toBe(401);
  expect(onExpired).toHaveBeenCalledOnce();
  expect(session.getRefreshToken()).toBeNull();
  expect(session.getAccessToken()).toBeNull();
});

test("a refresh that fails on the network keeps the session", async () => {
  session.setTokens({ access: "expired", refresh: "r1" });
  server.use(
    protectedEndpoint("never"),
    http.post(`${API}/auth/token/refresh/`, () => HttpResponse.error()),
  );

  await expect(api.get("/protected/")).rejects.toBeInstanceOf(ApiError);
  expect(session.getRefreshToken()).toBe("r1");
});

test("auth endpoints do not trigger a refresh", async () => {
  session.setTokens({ access: "expired", refresh: "r1" });
  const refresh = vi.fn();
  server.use(
    http.post(`${API}/auth/token/`, () => fail(401, "No active account found")),
    http.post(`${API}/auth/token/refresh/`, () => {
      refresh();
      return ok({ access: "a", refresh: "b" });
    }),
  );

  const error = (await api.post("/auth/token/", {}).catch((e: unknown) => e)) as ApiError;

  expect(error.message).toBe("No active account found");
  expect(refresh).not.toHaveBeenCalled();
});

test("without a refresh token a 401 is returned as is", async () => {
  server.use(protectedEndpoint("never"));

  const error = (await api.get("/protected/").catch((e: unknown) => e)) as ApiError;

  expect(error.status).toBe(401);
});
