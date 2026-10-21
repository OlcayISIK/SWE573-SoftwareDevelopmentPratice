import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";

import { pinIcon } from "./pinIcon";
import { FitWorld, WorldTiles } from "./world";
import { singleWorldOptions } from "./worldOptions";

export interface LocationMapProps {
  position: [number, number] | null;
  /** A point found for the typed address; the map moves there when it changes. */
  target?: [number, number] | null;
  onPick: (latitude: number, longitude: number) => void;
}

const STREET_ZOOM = 15;

function MoveTo({ target }: { target: [number, number] | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), STREET_ZOOM));
  }, [map, target]);
  return null;
}

function ClickToPick({ onPick }: Pick<LocationMapProps, "onPick">) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export default function LocationMap({ position, target, onPick }: LocationMapProps) {
  return (
    <div
      role="region"
      aria-label="Pick the location on the map"
      className="h-72 overflow-hidden rounded-xl shadow-sm ring-1 ring-stone-300"
    >
      <MapContainer
        center={position ?? [20, 0]}
        zoom={position ? 6 : 2}
        {...singleWorldOptions}
        className="h-full w-full"
      >
        <WorldTiles />
        <FitWorld focus={position ?? undefined} focusZoom={6} />
        <MoveTo target={target} />
        <ClickToPick onPick={onPick} />
        {position && (
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = event.target.getLatLng();
                onPick(lat, lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
