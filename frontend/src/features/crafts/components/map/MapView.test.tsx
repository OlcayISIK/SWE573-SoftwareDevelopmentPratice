import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.unmock("@/features/crafts/components/map/MapView");

const pins = [
  { id: 1, name: "Kütahya Çinisi", category: "ceramics", latitude: 39.42, longitude: 29.98 },
  { id: 2, name: "Barro negro", category: "ceramics", latitude: 17.06, longitude: -96.72 },
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
