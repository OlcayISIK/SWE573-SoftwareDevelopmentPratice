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

    await screen.findByRole("option", { name: "Kütahya" });
    await userEvent.selectOptions(screen.getByLabelText("Category"), "ceramics");
    await userEvent.selectOptions(screen.getByLabelText("Region"), "10");
    await userEvent.type(screen.getByLabelText("Search"), "çini");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() =>
      expect(router.state.location.search).toBe("?category=ceramics&region=10&search=%C3%A7ini"),
    );
    const last = calls.at(-1)!;
    expect([last.get("category"), last.get("region"), last.get("search")]).toEqual([
      "ceramics",
      "10",
      "çini",
    ]);
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

    await screen.findByRole("option", { name: "Ceramics" });
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
