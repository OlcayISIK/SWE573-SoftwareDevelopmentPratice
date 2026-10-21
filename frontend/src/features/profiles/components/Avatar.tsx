const COLORS = ["#1d5c8a", "#17706f", "#2b4a9a", "#4c7444", "#b4532f", "#5b3f7a"];

function colorFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return COLORS[hash % COLORS.length];
}

export function Avatar({
  src,
  name,
  size = 96,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={style}
        className="rounded-full object-cover ring-4 ring-white shadow-md"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size / 2.5, backgroundColor: colorFor(name) }}
      className="flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-white shadow-md ring-4 ring-white"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
