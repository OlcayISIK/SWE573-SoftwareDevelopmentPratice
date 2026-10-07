import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "./leafletSetup";
import "leaflet.markercluster";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import { config } from "@/lib/config";

import type { CraftPin } from "../../types";

import { pinIcon } from "./pinIcon";

export interface MapViewProps {
  pins: CraftPin[];
  onSelect: (id: number) => void;
}

function ClusteredPins({ pins, onSelect }: MapViewProps) {
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

export default function MapView({ pins, onSelect }: MapViewProps) {
  return (
    <div role="region" aria-label="Map of crafts" className="h-full w-full">
      <MapContainer center={[25, 15]} zoom={2} minZoom={2} worldCopyJump className="h-full w-full">
        <TileLayer
          url={config.mapTileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ClusteredPins pins={pins} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
