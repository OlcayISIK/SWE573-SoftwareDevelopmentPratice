import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import type { PublicProfile } from "@/features/profiles/api";
import { profilesApi } from "@/features/profiles/api";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftListItem, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function makeProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: 7,
    display_name: "Ayşe",
    bio: "Ceramics lover from Anatolia.",
    city: "İstanbul",
    country: "Türkiye",
    avatar: null as unknown as string,
    email: null as unknown as string,
    date_joined: "2026-10-01T10:00:00Z",
    ...overrides,
  } as PublicProfile;
}

function serveProfile(profile: PublicProfile, crafts = [makeCraftListItem()]) {
  server.use(
    http.get(`${API}/users/${profile.id}/`, () => ok(profile)),
    http.get(`${API}/users/${profile.id}/crafts/`, () =>
      ok({ items: crafts, total: crafts.length, page: 1, pageSize: 20, totalPages: 1 }),
    ),
  );
}

test("a public profile shows the general location and the user's crafts", async () => {
  serveProfile(makeProfile());
  renderRoute("/users/7");

  expect(await screen.findByRole("heading", { level: 1, name: "Ayşe" })).toBeInTheDocument();
  expect(screen.getByText("İstanbul, Türkiye")).toBeInTheDocument();
  expect(screen.getByText("Ceramics lover from Anatolia.")).toBeInTheDocument();
  expect(screen.getByText("Joined October 2026")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  const crafts = screen.getByRole("heading", { name: "Crafts added by Ayşe" }).parentElement!;
  expect(await within(crafts).findByRole("link", { name: "Kütahya Çinisi" })).toBeInTheDocument();
});

test("the email is shown only when the user chose to show it", async () => {
  serveProfile(makeProfile({ email: "ayse@example.com" }));
  renderRoute("/users/7");

  expect(await screen.findByRole("link", { name: "ayse@example.com" })).toHaveAttribute(
    "href",
    "mailto:ayse@example.com",
  );
});

test("unavailable profiles show a clear message", async () => {
  server.use(http.get(`${API}/users/99/`, () => fail(404, "This profile is unavailable.")));
  renderRoute("/users/99");

  expect(await screen.findByRole("heading", { name: "Profile unavailable" })).toBeInTheDocument();
});

test("the own profile page shows private details and links to settings", async () => {
  server.use(
    ...signedIn(makeUser({ show_email: false })),
    http.get(`${API}/users/7/crafts/`, () =>
      ok({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
    ),
  );
  renderRoute("/me");

  expect(await screen.findByText("(hidden from others)")).toBeInTheDocument();
  expect(screen.getByText("ayse@example.com")).toBeInTheDocument();
  expect(screen.getByText("Verified")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Edit profile and privacy" })).toHaveAttribute(
    "href",
    "/me/settings",
  );
  expect(await screen.findByText("No crafts yet.")).toBeInTheDocument();
});

test("the header links the user's name to their profile", async () => {
  server.use(...signedIn());
  renderRoute("/");

  expect(await screen.findByRole("link", { name: "Ayşe" })).toHaveAttribute("href", "/me");
});

test("saving profile and privacy settings", async () => {
  const patches: unknown[] = [];
  server.use(
    ...signedIn(),
    http.patch(`${API}/me/`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return ok(makeUser({ ...(body as object), display_name: String(body.display_name) }));
    }),
  );
  renderRoute("/me/settings");

  const name = await screen.findByLabelText("Display name");
  await waitFor(() => expect(name).toHaveValue("Ayşe"));
  await userEvent.clear(name);
  await userEvent.type(name, "Ayşe K.");
  await userEvent.clear(screen.getByLabelText("City"));
  await userEvent.type(screen.getByLabelText("City"), "Kütahya");
  await userEvent.click(screen.getByRole("checkbox", { name: /Show my email address/ }));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(patches).toHaveLength(1));
  expect(patches[0]).toEqual({
    display_name: "Ayşe K.",
    bio: "",
    city: "Kütahya",
    country: "Türkiye",
    show_email: true,
  });
  expect(await screen.findByRole("link", { name: "Ayşe K." })).toHaveAttribute("href", "/me");
});

test("server errors are shown next to the field", async () => {
  server.use(
    ...signedIn(),
    http.patch(`${API}/me/`, () =>
      fail(400, "Validation failed.", {
        city: ["Ensure this field has no more than 100 characters."],
      }),
    ),
  );
  renderRoute("/me/settings");

  await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveValue("Ayşe"));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));

  expect(
    await screen.findByText("Ensure this field has no more than 100 characters."),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("City")).toHaveAttribute("aria-invalid", "true");
});

test("uploading and removing a profile photo", async () => {
  server.use(...signedIn(makeUser({ avatar: "http://localhost:8000/media/avatars/a.png" })));
  const upload = vi
    .spyOn(profilesApi, "uploadAvatar")
    .mockResolvedValue(makeUser({ avatar: "http://localhost:8000/media/avatars/b.png" }));
  const remove = vi
    .spyOn(profilesApi, "removeAvatar")
    .mockResolvedValue(makeUser({ avatar: null as never }));
  renderRoute("/me/settings");

  const file = new File(["png"], "me.png", { type: "image/png" });
  await userEvent.upload(await screen.findByLabelText("Upload a new photo"), file);
  await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
  expect(await screen.findByRole("img", { name: "Ayşe" })).toHaveAttribute(
    "src",
    "http://localhost:8000/media/avatars/b.png",
  );

  await userEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  expect(screen.queryByRole("img", { name: "Ayşe" })).not.toBeInTheDocument();
});

test("profile pages require login", async () => {
  const { router } = renderRoute("/me/settings");

  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
});

test("the settings page has no accessibility violations", async () => {
  server.use(...signedIn());
  const { container } = renderRoute("/me/settings");
  await waitFor(() => expect(screen.getByLabelText("Display name")).toHaveValue("Ayşe"));

  await expectNoA11yViolations(container);
});
