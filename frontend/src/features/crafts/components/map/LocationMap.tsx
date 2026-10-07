import "leaflet/dist/leaflet.css";

import { MapContainer, Marker, useMapEvents } from "react-leaflet";

import { pinIcon } from "./pinIcon";
import { FitWorld, WorldTiles } from "./world";
import { singleWorldOptions } from "./worldOptions";

export interface LocationMapProps {
  position: [number, number] | null;
  onPick: (latitude: number, longitude: number) => void;
}

function ClickToPick({ onPick }: Pick<LocationMapProps, "onPick">) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export default function LocationMap({ position, onPick }: LocationMapProps) {
  return (
    <div
      role="region"
      aria-label="Pick the location on the map"
      className="h-72 overflow-hidden rounded border border-stone-300"
    >
      <MapContainer
        center={position ?? [20, 0]}
        zoom={position ? 6 : 2}
        {...singleWorldOptions}
        className="h-full w-full"
      >
        <WorldTiles />
        <FitWorld focus={position ?? undefined} focusZoom={6} />
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
