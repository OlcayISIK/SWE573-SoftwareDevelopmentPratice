import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import { useEffect } from "react";
import { TileLayer, useMap } from "react-leaflet";

import { config } from "@/lib/config";

import { WORLD_BOUNDS, WORLD_VIEW } from "./worldOptions";

const TILE_SIZE = 256;

export function WorldTiles() {
  return (
    <TileLayer
      url={config.mapTileUrl}
      noWrap
      bounds={WORLD_BOUNDS}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    />
  );
}

/**
 * The zoom at which the world is exactly as wide as the map, so there is no empty space at the
 * sides. A map taller than it is wide uses its height instead, since the world is square.
 * Returns null before the map has been laid out.
 */
function fillZoom(map: LeafletMap) {
  const { x, y } = map.getSize();
  return x > 0 && y > 0 ? Math.log2(Math.max(x, y) / TILE_SIZE) : null;
}

function viewCenter(map: LeafletMap, zoom: number) {
  const north = map.project([WORLD_VIEW[1][0], 0], zoom);
  const south = map.project([WORLD_VIEW[0][0], 0], zoom);
  return map.unproject(north.add(south).divideBy(2), zoom);
}

/**
 * Shows the world filling the width of the map, and keeps that as the furthest zoom-out level.
 * Until the user drags or zooms, the world is fitted again whenever the map changes size, so it
 * is right once the layout settles. With `focus`, the map opens on that point instead.
 */
export function FitWorld({
  focus,
  focusZoom = 5,
}: {
  focus?: LatLngExpression;
  focusZoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    let following = !focus;
    let adjusting = false;

    const fit = () => {
      const zoom = fillZoom(map);
      if (zoom === null) return;
      adjusting = true;
      // Raising the minimum above the current zoom makes Leaflet start its own animated zoom,
      // which would undo the view set here. So only lower it first and raise it at the end.
      map.setMinZoom(Math.min(map.getMinZoom(), zoom));
      if (following) {
        map.setView(viewCenter(map, zoom), zoom, { animate: false });
      } else if (map.getZoom() < zoom) {
        map.setZoom(zoom, { animate: false });
      }
      map.setMinZoom(zoom);
      adjusting = false;
    };
    const stopFollowing = () => {
      if (!adjusting) following = false;
    };

    fit();
    if (focus) {
      map.setView(focus, Math.max(fillZoom(map) ?? 0, focusZoom), { animate: false });
    }

    map.on("resize", fit);
    map.on("dragstart zoomstart", stopFollowing);
    // Leaflet only notices window resizes, not the layout settling around the map.
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      map.off("resize", fit);
      map.off("dragstart zoomstart", stopFollowing);
    };
    // Center once when the map opens; later prop changes must not jump the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
