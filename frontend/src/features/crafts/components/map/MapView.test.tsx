import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.unmock("@/features/crafts/components/map/MapView");

const pins = [
  {
    id: 1,
    place: 11,
    name: "Kütahya Çinisi",
    category: "ceramics",
    category_icon: "amphora",
    latitude: 39.42,
    longitude: 29.98,
  },
  {
    id: 2,
    place: 12,
    name: "Barro negro",
    category: "ceramics",
    category_icon: "amphora",
    latitude: 17.06,
    longitude: -96.72,
  },
];

// jsdom has no layout, so Leaflet would see a 0x0 map and draw nothing.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 768 });
});
afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

test("the real Leaflet map loads the cluster plugin and selects pins", async () => {
  const onSelect = vi.fn();
  const { default: MapView } = await import("./MapView");
  render(<MapView pins={pins} onSelect={onSelect} />);

  expect(screen.getByRole("region", { name: "Map of crafts" })).toBeInTheDocument();
  const marker = await screen.findByRole("button", { name: "Kütahya Çinisi" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Barro negro" })).toBeVisible());

  await userEvent.click(marker);

  expect(onSelect).toHaveBeenCalledWith(1);
});

test("the selected craft's pin is bigger, with a border, until it is deselected", async () => {
  const { default: MapView } = await import("./MapView");
  // The same handler on every render, as on the map page, so the map is not rebuilt.
  const onSelect = vi.fn();
  const { rerender } = render(<MapView pins={pins} onSelect={onSelect} />);
  const pinOf = async (name: string) =>
    (await screen.findByRole("button", { name })).querySelector(".craft-pin");

  expect(await pinOf("Kütahya Çinisi")).not.toHaveClass("is-selected");

  rerender(<MapView pins={pins} onSelect={onSelect} selectedId={1} />);
  await waitFor(async () => expect(await pinOf("Kütahya Çinisi")).toHaveClass("is-selected"));
  expect((await pinOf("Kütahya Çinisi"))?.querySelector("path")).toHaveAttribute(
    "stroke",
    "#e5a73a",
  );
  expect(await pinOf("Barro negro")).not.toHaveClass("is-selected");

  rerender(<MapView pins={pins} onSelect={onSelect} selectedId={2} />);
  await waitFor(async () => expect(await pinOf("Barro negro")).toHaveClass("is-selected"));
  expect(await pinOf("Kütahya Çinisi")).toHaveClass("is-settled");

  rerender(<MapView pins={pins} onSelect={onSelect} selectedId={null} />);
  await waitFor(async () => expect(await pinOf("Barro negro")).toHaveClass("is-settled"));
});

test("the world is shown once: no tile is drawn twice", async () => {
  const { default: MapView } = await import("./MapView");
  const { container } = render(<MapView pins={pins} onSelect={() => undefined} />);

  await waitFor(() =>
    expect(container.querySelectorAll("img.leaflet-tile").length).toBeGreaterThan(0),
  );
  const sources = [...container.querySelectorAll<HTMLImageElement>("img.leaflet-tile")].map(
    (tile) => tile.getAttribute("src"),
  );
  expect(new Set(sources).size).toBe(sources.length);
});
