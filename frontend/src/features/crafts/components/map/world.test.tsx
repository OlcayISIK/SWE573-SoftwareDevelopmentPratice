import { render, waitFor } from "@testing-library/react";
import type { Map as LeafletMap } from "leaflet";
import { MapContainer, useMap } from "react-leaflet";

import { FitWorld, WorldTiles } from "./world";
import { singleWorldOptions } from "./worldOptions";

function setBoxSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: height,
  });
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

function openMap() {
  let captured: LeafletMap | null = null;
  function Capture() {
    captured = useMap();
    return null;
  }
  render(
    <MapContainer center={[20, 0]} zoom={2} {...singleWorldOptions}>
      <WorldTiles />
      <FitWorld />
      <Capture />
    </MapContainer>,
  );
  return () => captured as unknown as LeafletMap;
}

test("the world fills the width of the map with no empty space at the sides", async () => {
  // At 1024px wide the world fits at zoom 2 exactly, so the check does not depend on snapping.
  setBoxSize(1024, 512);
  const getMap = openMap();

  await waitFor(() => expect(getMap()).not.toBeNull());
  const map = getMap();

  expect(map.getZoom()).toBe(2);
  expect(map.getBounds().getWest()).toBeCloseTo(-180);
  expect(map.getBounds().getEast()).toBeCloseTo(180);
  // Zooming out further is not allowed, so the world never shrinks into a repeating strip.
  expect(map.getMinZoom()).toBe(2);
});

test.each([
  [1600, 600, 1600],
  [700, 350, 700],
  [400, 600, 600],
])(
  "in a %ix%i box the world is %ipx across at the furthest zoom",
  async (width, height, across) => {
    setBoxSize(width, height);
    const getMap = openMap();

    await waitFor(() => expect(getMap()).not.toBeNull());
    const map = getMap();

    expect(256 * 2 ** map.getMinZoom()).toBeCloseTo(across);
  },
);
