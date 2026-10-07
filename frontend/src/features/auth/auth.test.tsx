import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import type { RouteObject } from "react-router";

import { session } from "@/api/session";
import { routes as appRoutes } from "@/app/router";
import { makeUser, sessionHandlers, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";
import { toast } from "@/lib/toast";

import { RequireAdmin, RequireAuth } from "./components/RouteGuards";
import { safeNextPath } from "./context";

const guardedRoutes: RouteObject[] = [
  {
    element: appRoutes[0].element,
    children: [
      {
        element: <RequireAuth />,
        children: [{ path: "private", element: <h1>Private page</h1> }],
      },
      {
        element: <RequireAdmin />,
        children: [{ path: "admin-only", element: <h1>Admin page</h1> }],
      },
      ...(appRoutes[0].children ?? []),
    ],
  },
];

function loginHandlers(user = makeUser()) {
  return [
    http.post(`${API}/auth/token/`, async ({ request }) => {
      const body = (await request.json()) as { email: string; password: string };
      return body.password === "correct-password"
        ? ok({ access: "access-1", refresh: "refresh-1" })
        : fail(401, "No active account found with the given credentials");
    }),
    http.get(`${API}/me/`, () => ok(user)),
  ];
}

async function fillLogin(password = "correct-password") {
  await userEvent.type(await screen.findByLabelText("Email"), "ayse@example.com");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

test("guests see a log in link", async () => {
  renderRoute("/");

  expect(await screen.findByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
});

test("a stored session is restored on load", async () => {
  server.use(...signedIn());

  renderRoute("/");

  expect(await screen.findByText("Ayşe")).toBeInTheDocument();
  expect(session.getAccessToken()).toBe("access-1");
  expect(session.getRefreshToken()).toBe("refresh-2");
});

test("an expired stored session falls back to guest", async () => {
  localStorage.setItem("ic.refresh", "old");
  server.use(http.post(`${API}/auth/token/refresh/`, () => fail(401, "Token is blacklisted")));

  renderRoute("/");

  expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
});

test("logging in stores the session and returns to the requested page", async () => {
  server.use(...loginHandlers());
  const { router } = renderRoute("/private", { routes: guardedRoutes });

  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(router.state.location.search).toBe("?next=%2Fprivate");
  await fillLogin();

  expect(await screen.findByRole("heading", { name: "Private page" })).toBeInTheDocument();
  expect(screen.getByText("Ayşe")).toBeInTheDocument();
  expect(session.getRefreshToken()).toBe("refresh-1");
});

test("wrong credentials show a form error", async () => {
  server.use(...loginHandlers());
  renderRoute("/login");

  await fillLogin("wrong-password");

  expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  expect(session.getRefreshToken()).toBeNull();
});

test("the login form validates before submitting", async () => {
  const request = vi.fn();
  server.use(http.post(`${API}/auth/token/`, () => (request(), ok({}))));
  renderRoute("/login");

  await userEvent.click(await screen.findByRole("button", { name: "Log in" }));

  expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
  expect(screen.getByText("Enter your password.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  expect(request).not.toHaveBeenCalled();
});

test("logging out ends the session", async () => {
  const logout = vi.fn();
  server.use(
    ...signedIn(),
    http.post(`${API}/auth/logout/`, async ({ request }) => {
      logout(await request.json());
      return new Response(null, { status: 204 });
    }),
  );
  renderRoute("/");

  await userEvent.click(await screen.findByRole("button", { name: "Log out" }));

  expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
  expect(logout).toHaveBeenCalledWith({ refresh: "refresh-2" });
  expect(session.getRefreshToken()).toBeNull();
});

test("an expired session signs the user out and explains why", async () => {
  server.use(...signedIn());
  renderRoute("/");
  await screen.findByText("Ayşe");

  session.expire();

  expect(await screen.findByRole("link", { name: "Log in" })).toBeInTheDocument();
  expect(toast.getSnapshot()[0].message).toContain("session has ended");
});

test("admin pages refuse regular users", async () => {
  server.use(...signedIn(makeUser({ role: "user" })));
  renderRoute("/admin-only", { routes: guardedRoutes });

  expect(await screen.findByRole("heading", { name: "Not authorized" })).toBeInTheDocument();
});

test("admin pages open for admins", async () => {
  server.use(...sessionHandlers(makeUser({ role: "admin" })));
  localStorage.setItem("ic.refresh", "refresh-1");
  renderRoute("/admin-only", { routes: guardedRoutes });

  expect(await screen.findByRole("heading", { name: "Admin page" })).toBeInTheDocument();
});

test("signed-in users visiting the login page are sent on", async () => {
  server.use(...signedIn());
  const { router } = renderRoute("/login?next=/private", { routes: guardedRoutes });

  await waitFor(() => expect(router.state.location.pathname).toBe("/private"));
});

test.each([
  ["/crafts/3", "/crafts/3"],
  ["//evil.example.com", "/"],
  ["https://evil.example.com", "/"],
  [null, "/"],
])("only same-site next paths are followed (%s)", (next, expected) => {
  expect(safeNextPath(next)).toBe(expected);
});

test("password reset request shows the same message for any email", async () => {
  server.use(
    http.post(`${API}/auth/password-reset/`, () =>
      ok({ detail: "If the account exists, a password reset email has been sent." }),
    ),
  );
  renderRoute("/password-reset");

  await userEvent.type(await screen.findByLabelText("Email"), "someone@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

  expect(await screen.findByRole("status")).toHaveTextContent("If the account exists");
});

test("choosing a new password from the email link", async () => {
  const confirm = vi.fn();
  server.use(
    http.post(`${API}/auth/password-reset/confirm/`, async ({ request }) => {
      confirm(await request.json());
      return ok({ detail: "Your password has been reset." });
    }),
  );
  renderRoute("/password-reset?uid=MQ&token=abc-123");

  await userEvent.type(await screen.findByLabelText("New password"), "An0ther-Str0ng-Pass!");
  await userEvent.type(screen.getByLabelText("Confirm new password"), "An0ther-Str0ng-Pass!");
  await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

  expect(await screen.findByRole("heading", { name: "Password changed" })).toBeInTheDocument();
  expect(confirm).toHaveBeenCalledWith({
    uid: "MQ",
    token: "abc-123",
    new_password: "An0ther-Str0ng-Pass!",
  });
});

test("server password rules are shown next to the field", async () => {
  server.use(
    http.post(`${API}/auth/password-reset/confirm/`, () =>
      fail(400, "Validation failed.", { new_password: ["This password is too common."] }),
    ),
  );
  renderRoute("/password-reset?uid=MQ&token=abc-123");

  await userEvent.type(await screen.findByLabelText("New password"), "password123");
  await userEvent.type(screen.getByLabelText("Confirm new password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

  expect(await screen.findByText("This password is too common.")).toBeInTheDocument();
});

test("an invalid reset link is explained", async () => {
  server.use(
    http.post(`${API}/auth/password-reset/confirm/`, () =>
      fail(400, "This password reset link is invalid or has expired."),
    ),
  );
  renderRoute("/password-reset?uid=MQ&token=old");

  await userEvent.type(await screen.findByLabelText("New password"), "An0ther-Str0ng-Pass!");
  await userEvent.type(screen.getByLabelText("Confirm new password"), "An0ther-Str0ng-Pass!");
  await userEvent.click(screen.getByRole("button", { name: "Set new password" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
});
