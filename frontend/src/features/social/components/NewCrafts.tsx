import { Link } from "react-router";

import type { CraftListItem } from "@/features/crafts/types";

// Up to this many new crafts are shown with who added them and when; more are shown as titles.
const DETAILED = 3;
const TITLES_SHOWN = 8;
const DAY = 24 * 60 * 60 * 1000;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "today", "yesterday", or "2 days ago". */
function addedAgo(createdAt: string, now = Date.now()) {
  const days = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / DAY));
  return relative.format(-days, "day");
}

/** The crafts people the user follows added in the last three days. */
export function NewCrafts({ crafts, total }: { crafts: CraftListItem[]; total: number }) {
  if (crafts.length === 0) {
    return null;
  }
  const detailed = total <= DETAILED;
  const shown = detailed ? crafts : crafts.slice(0, TITLES_SHOWN);
  const more = total - shown.length;

  return (
    <div className="mt-4 border-t border-stone-200 pt-3">
      <h3 id="new-crafts" className="text-sm font-semibold text-deep-sea">
        New in the last 3 days
      </h3>
      <ul
        aria-labelledby="new-crafts"
        className={detailed ? "mt-2 space-y-1" : "mt-1.5 space-y-0.5"}
      >
        {shown.map((craft) => (
          <li key={craft.id}>
            <Link
              to={`/crafts/${craft.id}`}
              className="block rounded-sm px-1.5 py-1 transition-colors hover:bg-sky-wash/60"
            >
              <span className="block truncate text-sm font-medium">{craft.name}</span>
              {detailed && (
                <span className="block truncate text-xs text-stone-600">
                  {craft.author.display_name} · {addedAgo(craft.created_at)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1 px-1.5 text-xs text-stone-600">and {more} more</p>}
    </div>
  );
}
