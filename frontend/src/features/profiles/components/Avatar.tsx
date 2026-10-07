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
        className="rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size / 2.5 }}
      className="flex items-center justify-center rounded-full bg-brand-200 font-semibold text-brand-900"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
