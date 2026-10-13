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
  story: "Tiles from Kütahya decorated mosques across the Ottoman lands.",
  attributes: {
    dimensions: [
      { type: "height", value: 20, unit: "cm" },
      { type: "width", value: 20, unit: "cm" },
    ],
    weight_g: 850,
    distinguishing_features: "Hand-painted floral motifs under a clear glaze",
  },
  colors: ["#1e40af", "#40e0d080"],
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

test("shows the description, story, characteristics, culture, and location", async () => {
  serveCraft(richCraft);
  renderRoute("/crafts/1");

  expect(await screen.findByRole("heading", { level: 1, name: "Kütahya Çinisi" })).toBeVisible();
  expect(screen.getByText("Ceramics · Tile")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "About this craft" })).toBeInTheDocument();
  expect(screen.getByText("Hand-painted glazed tiles.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Story" })).toBeInTheDocument();
  expect(screen.getByText(/decorated mosques across the Ottoman lands/)).toBeInTheDocument();
  expect(screen.getByText(/Turkish · From Kütahya, Türkiye/)).toBeInTheDocument();

  const characteristics = screen.getByRole("heading", { name: "Characteristics" }).parentElement!;
  expect(within(characteristics).getByText("height 20 cm, width 20 cm")).toBeInTheDocument();
  expect(within(characteristics).getByText("850 g")).toBeInTheDocument();
  // Colors are shown as swatches with their code, including see-through colors.
  expect(within(characteristics).getByText("#1e40af")).toBeInTheDocument();
  expect(within(characteristics).getByText("#40e0d080")).toBeInTheDocument();

  const aside = screen.getByRole("complementary", { name: "Facts and location" });
  expect(within(aside).getByText("Cumhuriyet Caddesi, Kütahya")).toBeInTheDocument();
  expect(await within(aside).findByRole("region", { name: "Map of crafts" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ayşe" })).toHaveAttribute("href", "/users/7");
});

test("a craft without a story has no story section", async () => {
  serveCraft(makeCraftDetail());
  renderRoute("/crafts/1");

  expect(await screen.findByRole("heading", { name: "About this craft" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Story" })).not.toBeInTheDocument();
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

test("the facts link to crafts that share them", async () => {
  serveCraft(
    makeCraftDetail({
      tools: [
        { id: 32, name: "Kiln", user_added: false },
        { id: 31, name: "Brush", user_added: false },
      ],
    }),
  );
  renderRoute("/crafts/1");

  const facts = (await screen.findByRole("heading", { name: "Craft facts" })).parentElement!;
  expect(within(facts).getByRole("link", { name: "Ceramics" })).toHaveAttribute(
    "href",
    "/crafts?category=ceramics",
  );
  expect(within(facts).getByRole("link", { name: "Tile" })).toHaveAttribute(
    "href",
    "/crafts?category=ceramics&craft_type=21",
  );
  expect(within(facts).getByRole("link", { name: "Turkish" })).toHaveAttribute(
    "href",
    "/crafts?culture=51",
  );
  expect(within(facts).getByText("Anatolia, Türkiye")).toBeInTheDocument();
  expect(within(facts).getByRole("link", { name: "Türkiye" })).toHaveAttribute(
    "href",
    "/crafts?country=T%C3%BCrkiye",
  );
  expect(within(facts).getByText("Kiln")).toBeInTheDocument();
  expect(within(facts).getByText("Brush")).toBeInTheDocument();
  expect(within(facts).getByText("Clay")).toBeInTheDocument();
});

describe("reporting items users added", () => {
  const craft = makeCraftDetail({
    author: { id: 50, display_name: "Mehmet" },
    tools: [
      { id: 32, name: "Kiln", user_added: false },
      { id: 98, name: "Spinning wheel", user_added: true },
    ],
  });

  test("a signed-in user reports a tool another user added", async () => {
    serveCraft(craft);
    const reports: unknown[] = [];
    server.use(
      ...signedIn(),
      http.post(`${API}/tools/98/report/`, async ({ request }) => {
        reports.push(await request.json());
        return ok({ id: 3, status: "open" }, { status: 201 });
      }),
    );
    renderRoute("/crafts/1");

    await userEvent.click(
      await screen.findByRole("button", { name: "Report tool Spinning wheel" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Report the tool “Spinning wheel”" });
    await userEvent.click(within(dialog).getByRole("radio", { name: /Duplicate/ }));
    await userEvent.type(within(dialog).getByLabelText("Details (optional)"), "Same as loom.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

    expect(await within(dialog).findByRole("status")).toHaveTextContent("An admin will review it.");
    expect(reports).toEqual([{ reason: "duplicate", note: "Same as loom." }]);
  });

  test("seeded items have no report button, and guests see none", async () => {
    serveCraft(craft);
    renderRoute("/crafts/1");

    await screen.findByRole("heading", { name: "Craft facts" });
    expect(screen.queryByRole("button", { name: /Report tool/ })).not.toBeInTheDocument();
  });

  test("the reason a report is refused is shown", async () => {
    serveCraft(craft);
    server.use(
      ...signedIn(),
      http.post(`${API}/tools/98/report/`, () => fail(400, "You cannot report an item you added.")),
    );
    renderRoute("/crafts/1");

    await userEvent.click(
      await screen.findByRole("button", { name: "Report tool Spinning wheel" }),
    );
    await userEvent.click(screen.getByRole("radio", { name: /Inaccurate/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("You cannot report an item you added.")).toBeInTheDocument();
  });
});
