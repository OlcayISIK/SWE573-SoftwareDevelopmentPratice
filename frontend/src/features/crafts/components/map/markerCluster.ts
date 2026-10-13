import L from "./leafletSetup";
import "leaflet.markercluster";

type Walk = (
  bounds: L.LatLngBounds,
  zoomLevelToStart: number,
  zoomLevelToStop: number,
  runAtEveryLevel?: (cluster: L.MarkerCluster) => void,
  runAtBottomLevel?: (cluster: L.MarkerCluster) => void,
) => void;

const prototype = L.MarkerCluster.prototype as unknown as { _recursively: Walk; _floored?: true };

/**
 * The map zooms out to a fractional level so the world fills its width. Leaflet.markercluster
 * 1.5 rounds the map's minimum zoom down almost everywhere, but not when it walks its clusters
 * to draw them, so markers that never join a cluster were never drawn. Rounding it down there
 * too keeps every marker on the map.
 */
if (!prototype._floored) {
  const walk = prototype._recursively;
  prototype._recursively = function (bounds, start, stop, everyLevel, bottomLevel) {
    walk.call(this, bounds, Math.floor(start), stop, everyLevel, bottomLevel);
  };
  prototype._floored = true;
}

export default L;
