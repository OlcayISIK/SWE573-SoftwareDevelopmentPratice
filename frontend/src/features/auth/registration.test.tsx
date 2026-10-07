import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import { expectNoA11yViolations } from "@/test/axe";
import { makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const RESEND_DETAIL =
  "If the account exists and is not verified yet, a new verification email has been sent.";

async function fillRegistration({ email = "new@example.com", password = "Str0ng-Passw0rd!" } = {}) {
  await userEvent.type(await screen.findByLabelText("Display name (optional)"), "Mehmet");
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

test("guests see a register link", async () => {
  renderRoute("/");

  expect(await screen.findByRole("link", { name: "Register" })).toHaveAttribute(
    "href",
    "/register",
  );
});

test("registering asks the user to check their email", async () => {
  const body = vi.fn();
  server.use(
    http.post(`${API}/auth/register/`, async ({ request }) => {
      body(await request.json());
      return ok({ id: 9, email: "new@example.com", is_email_verified: false }, { status: 201 });
    }),
  );
  renderRoute("/register");

  await fillRegistration();

  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  expect(screen.getByText("new@example.com")).toBeInTheDocument();
  expect(body).toHaveBeenCalledWith({
    email: "new@example.com",
    password: "Str0ng-Passw0rd!",
    display_name: "Mehmet",
  });
});

test("server errors appear next to the matching fields", async () => {
  server.use(
    http.post(`${API}/auth/register/`, () =>
      fail(409, "An account with this email already exists.", {
        email: ["An account with this email already exists."],
      }),
    ),
  );
  renderRoute("/register");

  await fillRegistration();

  expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
});

test("passwords must match before submitting", async () => {
  renderRoute("/register");

  await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "Str0ng-Passw0rd!");
  await userEvent.type(screen.getByLabelText("Confirm password"), "different-password");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("The passwords do not match.")).toBeInTheDocument();
});

test("the registration page has no accessibility violations", async () => {
  const { container } = renderRoute("/register");
  await screen.findByRole("heading", { name: "Create an account" });

  await expectNoA11yViolations(container);
});

test("opening the verification link confirms the email", async () => {
  const body = vi.fn();
  server.use(
    http.post(`${API}/auth/verify-email/`, async ({ request }) => {
      body(await request.json());
      return ok({ id: 9, email: "new@example.com", is_email_verified: true });
    }),
  );
  renderRoute("/verify-email?uid=OQ&token=abc-123");

  expect(await screen.findByRole("heading", { name: "Email verified" })).toBeInTheDocument();
  expect(within(screen.getByRole("main")).getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
  expect(body).toHaveBeenCalledWith({ uid: "OQ", token: "abc-123" });
});

test("a signed-in user is updated after verifying", async () => {
  let verified = false;
  server.use(
    ...signedIn(makeUser({ is_email_verified: false })),
    http.get(`${API}/me/`, () => ok(makeUser({ is_email_verified: verified }))),
    http.post(`${API}/auth/verify-email/`, () => {
      verified = true;
      return ok({ id: 7, email: "ayse@example.com", is_email_verified: true });
    }),
  );
  renderRoute("/verify-email?uid=Nw&token=abc-123");

  expect(await screen.findByRole("link", { name: "Go to the map" })).toBeInTheDocument();
});

test("an invalid verification link offers a new email", async () => {
  server.use(
    http.post(`${API}/auth/verify-email/`, () =>
      fail(400, "This verification link is invalid or has expired."),
    ),
    http.post(`${API}/auth/verify-email/resend/`, () => ok({ detail: RESEND_DETAIL })),
  );
  renderRoute("/verify-email?uid=OQ&token=expired");

  expect(
    await screen.findByRole("heading", { name: "This link does not work" }),
  ).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Email for the new link"), "new@example.com");
  await userEvent.click(screen.getByRole("button", { name: "Send a new verification email" }));

  expect(await screen.findByRole("status")).toHaveTextContent(RESEND_DETAIL);
});

test("a verification page without a token explains what to do", async () => {
  renderRoute("/verify-email");

  expect(
    await screen.findByRole("heading", { name: "This link does not work" }),
  ).toBeInTheDocument();
});

test("when the server verifies new accounts, the user is signed straight in", async () => {
  server.use(
    http.post(`${API}/auth/register/`, () =>
      ok({ id: 9, email: "new@example.com", is_email_verified: true }, { status: 201 }),
    ),
    http.post(`${API}/auth/token/`, () => ok({ access: "access-1", refresh: "refresh-1" })),
    http.get(`${API}/me/`, () => ok(makeUser({ id: 9, display_name: "Mehmet" }))),
  );
  const { router } = renderRoute("/register");

  await fillRegistration();

  expect(await screen.findByRole("link", { name: "Mehmet" })).toHaveAttribute("href", "/me");
  expect(router.state.location.pathname).toBe("/");
  expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
});

test("if signing in after registration fails, the user is sent to log in", async () => {
  server.use(
    http.post(`${API}/auth/register/`, () =>
      ok({ id: 9, email: "new@example.com", is_email_verified: true }, { status: 201 }),
    ),
    http.post(`${API}/auth/token/`, () => fail(429, "Request was throttled.")),
  );
  renderRoute("/register");

  await fillRegistration();

  expect(await screen.findByRole("heading", { name: "Your account is ready" })).toBeInTheDocument();
});
