import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";

import { expectNoA11yViolations } from "@/test/axe";
import { makeCraftDetail, makeCraftListItem } from "@/test/fixtures";
import { API, ok } from "@/test/http";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

function recordRequests(path: string, respond: (params: URLSearchParams) => unknown) {
  const calls: URLSearchParams[] = [];
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.push(params);
      return ok(respond(params));
    }),
  );
  return calls;
}

function page(items: unknown[], { page = 1, totalPages = 1, total = items.length } = {}) {
  return { items, total, page, pageSize: 20, totalPages };
}

describe("craft list", () => {
  test("shows crafts from all users with cover photos", async () => {
    recordRequests("/crafts/", () =>
      page([
        makeCraftListItem(),
        makeCraftListItem({ id: 2, name: "Uşak Halısı", cover_photo: null as never }),
      ]),
    );
    renderRoute("/crafts");

    expect(await screen.findByRole("link", { name: "Kütahya Çinisi" })).toHaveAttribute(
      "href",
      "/crafts/1",
    );
    expect(screen.getByRole("img", { name: "Blue tile" })).toBeInTheDocument();
    expect(screen.getByText("No photo yet")).toBeInTheDocument();
    expect(screen.getByText("2 crafts")).toBeInTheDocument();
  });

  test("filters are sent to the API and kept in the URL", async () => {
    const calls = recordRequests("/crafts/", () => page([makeCraftListItem()]));
    const { router } = renderRoute("/crafts");

    await screen.findByRole("option", { name: "Ceramics (2)" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "ceramics");
    await userEvent.type(screen.getByLabelText("Search"), "çini");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(router.state.location.search).toBe("?category=ceramics&search=%C3%A7ini"),
    );
    const last = calls.at(-1)!;
    expect([last.get("category"), last.get("search")]).toEqual(["ceramics", "çini"]);
  });

  test("craft type, culture, and country filters are sent to the API", async () => {
    const calls = recordRequests("/crafts/", () => page([makeCraftListItem()]));
    const { router } = renderRoute("/crafts");

    await screen.findByRole("option", { name: "Ceramics (2)" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "ceramics");
    await userEvent.selectOptions(
      screen.getByLabelText("Craft type"),
      await screen.findByRole("option", { name: "Tile (2)" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Culture"), "51");
    await userEvent.selectOptions(
      screen.getByLabelText("Country"),
      await screen.findByRole("option", { name: "Türkiye (2)" }),
    );

    await waitFor(() =>
      expect(router.state.location.search).toBe(
        "?category=ceramics&craft_type=21&culture=51&country=T%C3%BCrkiye",
      ),
    );
    const last = calls.at(-1)!;
    expect([last.get("craft_type"), last.get("culture"), last.get("country")]).toEqual([
      "21",
      "51",
      "Türkiye",
    ]);
  });

  test("filter lists only offer what the results have, with counts", async () => {
    const asked: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/crafts/facets/`, ({ request }) => {
        asked.push(new URL(request.url).searchParams);
        return ok({
          categories: [{ slug: "textiles", name: "Textiles", count: 3 }],
          craft_types: [{ id: 24, name: "Kilim", category: 2, count: 3 }],
          cultures: [{ id: 51, name: "Turkish", count: 3 }],
          countries: [{ name: "Türkiye", count: 3 }],
        });
      }),
    );
    renderRoute("/crafts?search=kilim");

    const country = await screen.findByLabelText("Country");
    expect(await within(country).findByRole("option", { name: "Türkiye (3)" })).toBeInTheDocument();
    expect(within(country).queryByRole("option", { name: /Mexico/ })).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Craft type")).getByRole("option", { name: "Kilim (3)" }),
    ).toBeInTheDocument();
    expect(asked.at(-1)!.get("search")).toBe("kilim");
  });

  test("a chosen value stays listed when the results no longer have it", async () => {
    server.use(
      http.get(`${API}/crafts/facets/`, () =>
        ok({ categories: [], craft_types: [], cultures: [], countries: [] }),
      ),
    );
    renderRoute("/crafts?country=Peru&search=kilim");

    expect(await screen.findByRole("option", { name: "Peru (0)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toHaveValue("Peru");
  });

  test("an empty search says so and offers to clear it", async () => {
    recordRequests("/crafts/", () => page([]));
    const { router } = renderRoute("/crafts?search=kilim");

    expect(await screen.findByText("No crafts match “kilim”.")).toBeInTheDocument();
    // The filter bar has its own Clear filters button; this is the one in the message.
    const buttons = screen.getAllByRole("button", { name: "Clear filters" });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  test("a new category clears the craft type filter", async () => {
    const { router } = renderRoute("/crafts?category=ceramics&craft_type=21");

    await waitFor(() => expect(screen.getByLabelText("Craft type")).toHaveValue("21"));
    await screen.findByRole("option", { name: "Textiles (1)" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "textiles");

    await waitFor(() => expect(router.state.location.search).toBe("?category=textiles"));
  });

  test("filters from a shared link are applied on load", async () => {
    const calls = recordRequests("/crafts/", () => page([]));
    renderRoute("/crafts?category=textiles&page=2");

    expect(await screen.findByText("No crafts match your filters.")).toBeInTheDocument();
    expect(calls[0].get("category")).toBe("textiles");
    expect(calls[0].get("page")).toBe("2");
    expect(screen.getByLabelText("Category")).toHaveValue("textiles");
  });

  test("changing a filter goes back to the first page", async () => {
    recordRequests("/crafts/", () => page([makeCraftListItem()], { page: 2, totalPages: 3 }));
    const { router } = renderRoute("/crafts?page=2");

    await screen.findByRole("option", { name: "Ceramics (2)" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "ceramics");

    await waitFor(() => expect(router.state.location.search).toBe("?category=ceramics"));
  });

  test("pagination moves between pages", async () => {
    const calls = recordRequests("/crafts/", (params) =>
      page([makeCraftListItem()], { page: Number(params.get("page") ?? 1), totalPages: 3 }),
    );
    renderRoute("/crafts");

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(calls.at(-1)!.get("page")).toBe("2");
  });

  test("clearing filters shows everything again", async () => {
    recordRequests("/crafts/", () => page([]));
    const { router } = renderRoute("/crafts?category=ceramics");

    const main = await screen.findByRole("main");
    await userEvent.click(
      (await within(main).findAllByRole("button", { name: "Clear filters" }))[0],
    );

    await waitFor(() => expect(router.state.location.search).toBe(""));
  });

  test("the craft list has no accessibility violations", async () => {
    recordRequests("/crafts/", () => page([makeCraftListItem()]));
    const { container } = renderRoute("/crafts");
    await screen.findByRole("link", { name: "Kütahya Çinisi" });

    await expectNoA11yViolations(container);
  });
});

describe("map", () => {
  const pins = [
    { id: 1, name: "Kütahya Çinisi", category: "ceramics", latitude: 39.42, longitude: 29.98 },
    { id: 2, name: "Uşak Halısı", category: "textiles", latitude: 38.68, longitude: 29.41 },
  ];

  test("an empty search on the map says nothing matches", async () => {
    server.use(http.get(`${API}/crafts/map/`, () => ok([])));
    renderRoute("/?search=kilim");

    expect(await screen.findByText("No crafts match “kilim”.")).toBeInTheDocument();
    expect(screen.getByText("0 crafts")).toBeInTheDocument();
  });

  test("shows pins and a preview card for the selected craft", async () => {
    recordRequests("/crafts/map/", () => pins);
    server.use(http.get(`${API}/crafts/1/`, () => ok(makeCraftDetail())));
    renderRoute("/");

    await userEvent.click(await screen.findByRole("button", { name: "Pin: Kütahya Çinisi" }));

    const preview = await screen.findByRole("complementary", { name: "Craft preview" });
    expect(await within(preview).findByRole("heading", { name: "Kütahya Çinisi" })).toBeVisible();
    expect(
      within(preview).getByRole("img", { name: "Blue tile with floral motifs" }),
    ).toBeVisible();
    expect(within(preview).getByRole("link", { name: "View details" })).toHaveAttribute(
      "href",
      "/crafts/1",
    );
    expect(within(preview).getByRole("button", { name: "Close preview" })).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Craft preview" })).not.toBeInTheDocument();
  });

  test("map filters come from the URL", async () => {
    const calls = recordRequests("/crafts/map/", () => pins.slice(0, 1));
    renderRoute("/?category=ceramics");

    expect(await screen.findByText("1 craft")).toBeInTheDocument();
    expect(calls[0].get("category")).toBe("ceramics");
    expect(calls[0].has("page")).toBe(false);
  });

  test("every map view can be shown as an accessible list", async () => {
    recordRequests("/crafts/map/", () => pins);
    const { router } = renderRoute("/");

    await userEvent.click(await screen.findByRole("button", { name: "View as list" }));

    const list = await screen.findByRole("region", { name: "Crafts as a list" });
    expect(within(list).getByRole("link", { name: "Uşak Halısı" })).toHaveAttribute(
      "href",
      "/crafts/2",
    );
    expect(within(list).getByText("Textiles")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?view=list");

    await userEvent.click(screen.getByRole("button", { name: "View on map" }));
    expect(await screen.findByRole("region", { name: "Map of crafts" })).toBeInTheDocument();
  });

  test("the list view has no accessibility violations", async () => {
    recordRequests("/crafts/map/", () => pins);
    const { container } = renderRoute("/?view=list");
    await screen.findByRole("region", { name: "Crafts as a list" });

    await expectNoA11yViolations(container);
  });
});
