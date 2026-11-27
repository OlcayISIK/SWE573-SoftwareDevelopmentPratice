import { Leaf, Hourglass, CircleSlash } from "lucide-react";

import { PRACTICE_STATUS_LABELS, type PracticeStatus } from "../practiceStatus";

// Dark text on a light background, at least 4.5:1, so each status reads in WCAG AA.
const STYLES: Record<
  Exclude<PracticeStatus, "unknown">,
  { className: string; icon: typeof Leaf }
> = {
  living: { className: "bg-moss-wash text-moss-dark ring-moss/30", icon: Leaf },
  endangered: { className: "bg-amber-100 text-amber-900 ring-amber-300", icon: Hourglass },
  no_longer_practiced: {
    className: "bg-stone-200 text-stone-800 ring-stone-300",
    icon: CircleSlash,
  },
};

/** The craft's practice status as a badge; an unknown status shows nothing. */
export function PracticeStatusBadge({
  status,
  size = "md",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  if (!(status in STYLES)) return null;
  const { className, icon: Icon } = STYLES[status as keyof typeof STYLES];
  const label = PRACTICE_STATUS_LABELS[status as PracticeStatus];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full font-semibold ring-1 ${className} ${
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <Icon aria-hidden="true" className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      <span className="sr-only">Practice status: </span>
      {label}
    </span>
  );
}

const URL_PATTERN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

/** The source of a status, with its links clickable. */
export function SourceText({ source }: { source: string }) {
  return (
    <>
      {source.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-brand-700 underline"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
