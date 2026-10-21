/** The logo: a globe drawn with woven lines, in the palette's ocean, lagoon, and clay. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18" fill="#1d5c8a" />
      <g fill="none" strokeWidth="1.6" strokeLinecap="round">
        <ellipse cx="20" cy="20" rx="8" ry="18" stroke="#dcebf5" />
        <path d="M3 14h34M3 26h34" stroke="#dcebf5" />
        <path d="M20 2v36" stroke="#dcebf5" opacity=".6" />
      </g>
      <path d="M20 13l4 7-4 7-4-7z" fill="#e5a73a" />
      <path d="M11 20l2.5-3 2.5 3-2.5 3zM24 20l2.5-3 2.5 3-2.5 3z" fill="#b4532f" />
    </svg>
  );
}
