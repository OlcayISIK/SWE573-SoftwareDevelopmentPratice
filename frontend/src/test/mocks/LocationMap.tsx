import type { LocationMapProps } from "@/features/crafts/components/map/LocationMap";

/** Stand-in for the Leaflet picker: one button picks a fixed spot in Kütahya. */
export default function MockLocationMap({ position, target, onPick }: LocationMapProps) {
  return (
    <div role="region" aria-label="Pick the location on the map">
      <button type="button" onClick={() => onPick(39.4192345, 29.9833471)}>
        Pick Kütahya on the map
      </button>
      {position && <p>Pin at {position.join(", ")}</p>}
      {target && <p>Map moved to {target.join(", ")}</p>}
    </div>
  );
}
