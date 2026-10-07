import type { MapViewProps } from "@/features/crafts/components/map/MapView";

/** jsdom cannot lay out a Leaflet map, so tests use this stand-in that exposes each pin. */
export default function MockMapView({ pins, onSelect }: MapViewProps) {
  return (
    <div role="region" aria-label="Map of crafts">
      {pins.map((pin) => (
        <button key={pin.id} type="button" onClick={() => onSelect(pin.id)}>
          Pin: {pin.name}
        </button>
      ))}
    </div>
  );
}
