import { screen, within } from "@testing-library/react";
import { http } from "msw";

import { makeCraftListItem, signedIn } from "@/test/fixtures";
import { API, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function page<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 20, totalPages: 1 };
}

const person = (id: number, display_name: string, city = "", country = "") => ({
  user: { id, display_name, avatar: null, city, country },
  since: "2026-10-07T10:00:00Z",
});

test("guests see prompts beside the map", async () => {
  renderRoute("/");

  const people = await screen.findByRole("complementary", { name: "People" });
  expect(
    within(people).getByRole("link", { name: "Log in to follow contributors" }),
  ).toHaveAttribute("href", "/login");
  const favorites = screen.getByRole("complementary", { name: "Favorites" });
  expect(
    within(favorites).getByRole("link", { name: "Log in to see your favorites" }),
  ).toBeVisible();
});

test("signed-in users see who they follow, their followers, and their favorites", async () => {
  server.use(
    ...signedIn(),
    http.get(`${API}/me/following/`, () =>
      ok(page([person(50, "Mehmet", "Uşak", "Türkiye"), person(51, "Elena")])),
    ),
    http.get(`${API}/me/followers/`, () => ok(page([person(60, "Kenji", "Kyoto", "Japan")]))),
    http.get(`${API}/me/favorites/`, () => ok(page([makeCraftListItem({ id: 3, name: "Kilim" })]))),
  );
  renderRoute("/");

  const people = await screen.findByRole("complementary", { name: "People" });
  const following = await within(people).findByRole("region", { name: "People you follow" });
  expect(within(following).getByRole("link", { name: /Mehmet/ })).toHaveAttribute(
    "href",
    "/users/50",
  );
  expect(within(following).getByText("Uşak, Türkiye")).toBeInTheDocument();
  expect(within(following).getByText("2")).toBeInTheDocument();
  const followers = within(people).getByRole("region", { name: "Your followers" });
  expect(await within(followers).findByRole("link", { name: /Kenji/ })).toBeInTheDocument();

  const favorites = screen.getByRole("complementary", { name: "Favorites" });
  expect(await within(favorites).findByRole("link", { name: /Kilim/ })).toHaveAttribute(
    "href",
    "/crafts/3",
  );
  expect(within(favorites).getByRole("link", { name: "View all (1)" })).toHaveAttribute(
    "href",
    "/me/favorites",
  );
});

test("empty panels explain how to fill them", async () => {
  server.use(...signedIn());
  renderRoute("/");

  expect(await screen.findByText(/You are not following anyone yet/)).toBeInTheDocument();
  expect(screen.getByText("No followers yet.")).toBeInTheDocument();
  expect(await screen.findByText(/No favorites yet/)).toBeInTheDocument();
});
