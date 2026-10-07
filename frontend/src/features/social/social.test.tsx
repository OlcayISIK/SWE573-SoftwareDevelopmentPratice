import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import { toast } from "@/lib/toast";
import { makeCraftDetail, makeCraftListItem, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function serveCraft() {
  server.use(
    http.get(`${API}/crafts/1/`, () =>
      ok(makeCraftDetail({ author: { id: 50, display_name: "Mehmet" } })),
    ),
  );
}

function serveProfile(id = 50) {
  server.use(
    http.get(`${API}/users/${id}/`, () =>
      ok({
        id,
        display_name: "Mehmet",
        bio: "",
        city: "Uşak",
        country: "Türkiye",
        avatar: null,
        email: null,
        date_joined: "2026-10-01T00:00:00Z",
      }),
    ),
    http.get(`${API}/users/${id}/crafts/`, () =>
      ok({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
    ),
  );
}

test("favoriting updates the button before the server answers", async () => {
  serveCraft();
  let favorited = false;
  server.use(
    ...signedIn(),
    http.get(`${API}/crafts/1/favorite/`, () =>
      ok({ favorited, favorites_count: favorited ? 4 : 3 }),
    ),
    http.post(`${API}/crafts/1/favorite/`, async () => {
      await delay(100);
      favorited = true;
      return ok({ favorited: true, favorites_count: 4 }, { status: 201 });
    }),
  );
  renderRoute("/crafts/1");

  const button = await screen.findByRole("button", { name: /Favorite \(3/ });
  expect(button).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(button);

  const pressed = screen.getByRole("button", { name: /Favorited \(4/ });
  expect(pressed).toHaveAttribute("aria-pressed", "true");
});

test("a rejected favorite rolls back and explains why", async () => {
  serveCraft();
  server.use(
    ...signedIn(),
    http.get(`${API}/crafts/1/favorite/`, () => ok({ favorited: false, favorites_count: 3 })),
    http.post(`${API}/crafts/1/favorite/`, () => fail(404, "Craft not found.")),
  );
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: /Favorite \(3/ }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Favorite \(3/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    ),
  );
  expect(toast.getSnapshot()[0].message).toBe("Craft not found.");
});

test("unfavoriting sends a delete", async () => {
  serveCraft();
  const deleted = vi.fn();
  server.use(
    ...signedIn(),
    http.get(`${API}/crafts/1/favorite/`, () => ok({ favorited: true, favorites_count: 1 })),
    http.delete(`${API}/crafts/1/favorite/`, () => {
      deleted();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: /Favorited/ }));

  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
});

test("guests are asked to log in and come back", async () => {
  serveCraft();
  renderRoute("/crafts/1");

  expect(await screen.findByRole("link", { name: "Log in to favorite" })).toHaveAttribute(
    "href",
    "/login?next=%2Fcrafts%2F1",
  );
});

test("following a user from their profile", async () => {
  serveProfile();
  let following = false;
  server.use(
    ...signedIn(),
    http.get(`${API}/users/50/follow/`, () =>
      ok({ following, followers_count: following ? 3 : 2, following_count: 5 }),
    ),
    http.post(`${API}/users/50/follow/`, () => {
      following = true;
      return ok({ following: true, followers_count: 3, following_count: 5 }, { status: 201 });
    }),
  );
  renderRoute("/users/50");

  expect(await screen.findByText(/followers/)).toHaveTextContent("2 followers · 5 following");
  await userEvent.click(screen.getByRole("button", { name: "Follow Mehmet" }));

  expect(await screen.findByRole("button", { name: "Following Mehmet" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await waitFor(() =>
    expect(screen.getByText(/followers/)).toHaveTextContent("3 followers · 5 following"),
  );
});

test("users do not see a follow button on their own profile", async () => {
  serveProfile(7);
  server.use(...signedIn(makeUser({ id: 7 })));
  renderRoute("/users/7");

  await screen.findByRole("heading", { level: 1, name: "Mehmet" });
  expect(screen.queryByRole("button", { name: /Follow/ })).not.toBeInTheDocument();
});

test("guests see a log in prompt instead of follow", async () => {
  serveProfile();
  renderRoute("/users/50");

  expect(await screen.findByRole("link", { name: "Log in to follow Mehmet" })).toBeInTheDocument();
});

test("the favorites page lists saved crafts", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/favorites/`, () =>
      ok({
        items: [makeCraftListItem({ name: "Saved craft" })],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    ),
  );
  renderRoute("/me/favorites");

  expect(await screen.findByRole("link", { name: "Saved craft" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("href", "/me/favorites");
});

test("an empty favorites page points to the map", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/favorites/`, () =>
      ok({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
    ),
  );
  renderRoute("/me/favorites");

  expect(await screen.findByRole("link", { name: "Explore the map" })).toHaveAttribute("href", "/");
});
