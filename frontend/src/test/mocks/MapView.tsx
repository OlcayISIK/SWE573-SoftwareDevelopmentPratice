import type { MapViewProps } from "@/features/crafts/components/map/MapView";

/** jsdom cannot lay out a Leaflet map, so tests use this stand-in that exposes each pin. */
export default function MockMapView({ pins, onSelect, selectedId }: MapViewProps) {
  return (
    <div role="region" aria-label="Map of crafts">
      {pins.map((pin) => (
        // A craft in several places has one pin per place, so the place tells pins apart.
        <button
          key={`${pin.id}-${pin.place}`}
          type="button"
          aria-pressed={pin.id === selectedId}
          onClick={() => onSelect(pin.id)}
        >
          Pin: {pin.name}
        </button>
      ))}
    </div>
  );
}
