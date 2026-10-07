/** A color sample; a checkerboard behind it shows how see-through the color is. */
export function Swatch({ color, className = "h-9 w-9" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded border border-stone-300 ${className}`}
      style={{
        backgroundImage: `linear-gradient(${color}, ${color}), repeating-conic-gradient(#d6d3d1 0 25%, #fff 0 50%)`,
        backgroundSize: "auto, 10px 10px",
      }}
    />
  );
}
