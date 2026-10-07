import type { LatLngTuple } from "leaflet";

type Box = [LatLngTuple, LatLngTuple];

/** How far the map can be panned: one world, without wrapping. */
export const WORLD_BOUNDS: Box = [
  [-85, -180],
  [85, 180],
];

/**
 * The latitudes the map opens centered on: from the north of Greenland down to Cape Horn.
 * Antarctica shows when the map has room for it and is reachable by panning.
 */
export const WORLD_VIEW: Box = [
  [-57, -180],
  [84, 180],
];

/** Map options that show a single copy of the world that cannot be dragged past its edges. */
export const singleWorldOptions = {
  maxBounds: WORLD_BOUNDS,
  maxBoundsViscosity: 1,
  worldCopyJump: false,
  minZoom: 0,
  // No snapping, so the world can be exactly as wide as the map instead of the nearest step.
  zoomSnap: 0,
  zoomDelta: 0.5,
};
