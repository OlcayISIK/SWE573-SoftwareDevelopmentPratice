import "leaflet/dist/leaflet.css";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

import { config } from "@/lib/config";

import { pinIcon } from "./pinIcon";

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
        center={position ?? [25, 15]}
        zoom={position ? 6 : 2}
        minZoom={2}
        className="h-full w-full"
      >
        <TileLayer
          url={config.mapTileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
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
