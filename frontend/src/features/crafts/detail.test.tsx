import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import type { CraftDetail } from "@/features/crafts/types";
import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeUser, signedIn } from "@/test/fixtures";
import { API, fail, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

const richCraft = makeCraftDetail({
  attributes: {
    dimensions_cm: { height: 20, width: 20 },
    weight_g: 850,
    colors: ["cobalt blue", "turquoise"],
    distinguishing_features: "Hand-painted floral motifs under a clear glaze",
  },
  media: [
    ...makeCraftDetail().media,
    {
      id: 101,
      media_type: "photo",
      file: "http://localhost:8000/media/crafts/1/b.png",
      url: "",
      caption: "Detail of the glaze",
      alt_text: "Close-up of turquoise glaze",
      order: 1,
    },
    {
      id: 102,
      media_type: "video",
      file: null,
      url: "https://www.youtube.com/watch?v=abc123",
      caption: "Painting a tile",
      alt_text: "",
      order: 2,
    },
    {
      id: 103,
      media_type: "document",
      file: "http://localhost:8000/media/crafts/1/source.pdf",
      url: "",
      caption: "Museum catalogue entry",
      alt_text: "",
      order: 3,
    },
  ] as CraftDetail["media"],
});

function serveCraft(craft: CraftDetail) {
  server.use(http.get(`${API}/crafts/${craft.id}/`, () => ok(craft)));
}

test("shows every description section, attributes, and the region", async () => {
  serveCraft(richCraft);
  renderRoute("/crafts/1");

  expect(await screen.findByRole("heading", { level: 1, name: "Kütahya Çinisi" })).toBeVisible();
  for (const heading of [
    "What it is",
    "How it is made",
    "How to understand it",
    "Cultural relevance",
  ]) {
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  }
  expect(screen.getByText("A living Anatolian tradition.")).toBeInTheDocument();

  const characteristics = screen.getByRole("heading", { name: "Characteristics" }).parentElement!;
  expect(within(characteristics).getByText("height 20 cm, width 20 cm")).toBeInTheDocument();
  expect(within(characteristics).getByText("850 g")).toBeInTheDocument();
  expect(within(characteristics).getByText("cobalt blue, turquoise")).toBeInTheDocument();

  const aside = screen.getByRole("complementary", { name: "Region and location" });
  expect(within(aside).getByText(/glazed tiles/)).toBeInTheDocument();
  expect(await within(aside).findByRole("region", { name: "Map of crafts" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ayşe" })).toHaveAttribute("href", "/users/7");
  expect(screen.getByRole("link", { name: "Kütahya, Türkiye" })).toHaveAttribute(
    "href",
    "/crafts?region=10",
  );
});

test("the gallery switches photos", async () => {
  serveCraft(richCraft);
  renderRoute("/crafts/1");

  expect(await screen.findByRole("img", { name: "Blue tile with floral motifs" })).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Show photo 2: Close-up of turquoise glaze" }),
  );

  expect(screen.getByRole("img", { name: "Close-up of turquoise glaze" })).toBeVisible();
  expect(screen.getByText("Detail of the glaze")).toBeInTheDocument();
});

test("videos are embedded and documents are linked", async () => {
  serveCraft(richCraft);
  renderRoute("/crafts/1");

  expect(await screen.findByTitle("Painting a tile")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/abc123",
  );
  expect(
    screen.getByRole("link", { name: "Museum catalogue entry (PDF, opens in a new tab)" }),
  ).toHaveAttribute("href", "http://localhost:8000/media/crafts/1/source.pdf");
});

test("missing or removed crafts show a not found page", async () => {
  server.use(http.get(`${API}/crafts/99/`, () => fail(404, "Craft not found.")));
  renderRoute("/crafts/99");

  expect(await screen.findByRole("heading", { name: "Craft not found" })).toBeInTheDocument();
});

test("guests and other users do not see edit or delete", async () => {
  serveCraft(richCraft);
  server.use(...signedIn(makeUser({ id: 99 })));
  renderRoute("/crafts/1");

  await screen.findByRole("heading", { level: 1, name: "Kütahya Çinisi" });
  expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
});

test("admins can manage any craft", async () => {
  serveCraft(richCraft);
  server.use(...signedIn(makeUser({ id: 99, role: "admin" })));
  renderRoute("/crafts/1");

  expect(await screen.findByRole("link", { name: "Edit" })).toHaveAttribute(
    "href",
    "/crafts/1/edit",
  );
});

test("the author deletes a craft after confirming", async () => {
  serveCraft(richCraft);
  const deleted = vi.fn();
  server.use(
    ...signedIn(makeUser({ id: 7 })),
    http.delete(`${API}/crafts/1/`, () => {
      deleted();
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const { router } = renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
  const dialog = screen.getByRole("dialog", { name: "Delete this craft?" });
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete craft" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/crafts"));
  expect(deleted).toHaveBeenCalledOnce();
});

test("cancelling the delete dialog keeps the craft", async () => {
  serveCraft(richCraft);
  server.use(...signedIn(makeUser({ id: 7 })));
  renderRoute("/crafts/1");

  await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await userEvent.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
});

test("authors see that their hidden craft was hidden by a moderator", async () => {
  serveCraft(makeCraftDetail({ status: "hidden" }));
  server.use(...signedIn(makeUser({ id: 7 })));
  renderRoute("/crafts/1");

  expect(await screen.findByText(/Hidden by a moderator/)).toBeInTheDocument();
});

test("the detail page has no accessibility violations", async () => {
  serveCraft(richCraft);
  const { container } = renderRoute("/crafts/1");
  await screen.findByRole("heading", { level: 1, name: "Kütahya Çinisi" });

  await expectNoA11yViolations(container);
});
