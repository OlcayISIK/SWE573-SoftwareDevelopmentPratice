import L from "./markerCluster";

function sizeElements(width: number, height: number) {
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

function drawnMarkers(points: [number, number][]) {
  sizeElements(862, 574);
  const container = document.createElement("div");
  document.body.append(container);
  // The world map's furthest zoom is fractional, so the world fills the map's width.
  const map = L.map(container, { minZoom: 1.75, maxZoom: 18, zoomSnap: 0 }).setView([40, 50], 1.75);
  const cluster = L.markerClusterGroup({ maxClusterRadius: 50 });
  points.forEach((point) => cluster.addLayer(L.marker(point)));
  map.addLayer(cluster);
  const drawn = Object.values(
    (cluster as unknown as { _featureGroup: { _layers: object } })._featureGroup._layers,
  ).length;
  map.remove();
  container.remove();
  return drawn;
}

test("markers too far apart to cluster are still drawn at a fractional zoom", () => {
  // Uşak in Türkiye and Kochkor in Kyrgyzstan, as found by searching "carpet".
  expect(
    drawnMarkers([
      [38.674, 29.406],
      [42.209, 75.63],
    ]),
  ).toBe(2);
});

test("markers close together are drawn as one cluster", () => {
  // Bonwire and Krofofrom, both near Kumasi in Ghana.
  expect(
    drawnMarkers([
      [6.793, -1.473],
      [6.614, -1.625],
    ]),
  ).toBe(1);
});
