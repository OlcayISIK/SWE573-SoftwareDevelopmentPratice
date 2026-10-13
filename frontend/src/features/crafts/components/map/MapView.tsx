import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "./markerCluster";

import { useEffect } from "react";
import { MapContainer, useMap } from "react-leaflet";

import type { CraftPin } from "../../types";

import { pinIcon } from "./pinIcon";
import { FitWorld, WorldTiles } from "./world";
import { singleWorldOptions } from "./worldOptions";

export interface MapViewProps {
  pins: CraftPin[];
  onSelect: (id: number) => void;
  /** Open on this point instead of the whole world, for example on a craft's page. */
  focus?: [number, number];
  /** Open showing all of these points, for example the places of a craft. */
  fit?: [number, number][];
}

function ClusteredPins({ pins, onSelect }: Pick<MapViewProps, "pins" | "onSelect">) {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
    for (const pin of pins) {
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: pinIcon,
        title: pin.name,
        alt: pin.name,
        keyboard: true,
      });
      marker.on("click", () => onSelect(pin.id));
      cluster.addLayer(marker);
    }
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, pins, onSelect]);

  return null;
}

export default function MapView({ pins, onSelect, focus, fit }: MapViewProps) {
  return (
    <div role="region" aria-label="Map of crafts" className="h-full w-full">
      <MapContainer center={[20, 0]} zoom={2} {...singleWorldOptions} className="h-full w-full">
        <WorldTiles />
        <FitWorld focus={focus} points={fit} />
        <ClusteredPins pins={pins} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
