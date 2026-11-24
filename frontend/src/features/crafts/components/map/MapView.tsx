import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import L from "./markerCluster";

import { useEffect, useRef } from "react";
import { MapContainer, useMap } from "react-leaflet";

import type { CraftPin } from "../../types";

import { clusterIcon, pinIconFor } from "./pinIcon";
import { FitWorld, WorldTiles } from "./world";
import { singleWorldOptions } from "./worldOptions";

export interface MapViewProps {
  pins: CraftPin[];
  onSelect: (id: number) => void;
  /** The craft shown in the preview card: its pins are bigger, with an amber border. */
  selectedId?: number | null;
  /** Open on this point instead of the whole world, for example on a craft's page. */
  focus?: [number, number];
  /** Open showing all of these points, for example the places of a craft. */
  fit?: [number, number][];
}

type PinMarker = { pin: CraftPin; marker: L.Marker };

function ClusteredPins({
  pins,
  onSelect,
  selectedId = null,
}: Pick<MapViewProps, "pins" | "onSelect" | "selectedId">) {
  const map = useMap();
  // The markers of each craft, so a new selection restyles them without rebuilding the map.
  const markers = useRef(new Map<number, PinMarker[]>());
  const highlighted = useRef<number | null>(null);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: clusterIcon,
    });
    const byCraft = new Map<number, PinMarker[]>();
    for (const pin of pins) {
      const marker = L.marker([pin.latitude, pin.longitude], {
        icon: pinIconFor(pin.category, pin.category_icon),
        title: pin.name,
        alt: pin.name,
        keyboard: true,
      });
      marker.on("click", () => onSelect(pin.id));
      cluster.addLayer(marker);
      byCraft.set(pin.id, [...(byCraft.get(pin.id) ?? []), { pin, marker }]);
    }
    markers.current = byCraft;
    highlighted.current = null;
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, pins, onSelect]);

  // Runs after every rebuild too, so the selected craft stays highlighted.
  useEffect(() => {
    const restyle = (id: number, selected: boolean) => {
      for (const { pin, marker } of markers.current.get(id) ?? []) {
        marker.setIcon(
          pinIconFor(pin.category, pin.category_icon, selected ? "selected" : "settled"),
        );
        marker.setZIndexOffset(selected ? 1000 : 0);
      }
    };
    if (highlighted.current !== null && highlighted.current !== selectedId) {
      restyle(highlighted.current, false);
    }
    if (selectedId !== null && highlighted.current !== selectedId) {
      restyle(selectedId, true);
    }
    highlighted.current = selectedId;
  }, [map, pins, onSelect, selectedId]);

  return null;
}

export default function MapView({ pins, onSelect, selectedId, focus, fit }: MapViewProps) {
  return (
    <div role="region" aria-label="Map of crafts" className="h-full w-full">
      <MapContainer center={[20, 0]} zoom={2} {...singleWorldOptions} className="h-full w-full">
        <WorldTiles />
        <FitWorld focus={focus} points={fit} />
        <ClusteredPins pins={pins} onSelect={onSelect} selectedId={selectedId} />
      </MapContainer>
    </div>
  );
}
