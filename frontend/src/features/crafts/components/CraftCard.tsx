import { Link } from "react-router";

import { placeName } from "../place";
import type { CraftListItem } from "../types";

export function CraftCard({ craft }: { craft: CraftListItem }) {
  return (
    <article className="overflow-hidden rounded-lg border border-brand-100 bg-white shadow-sm">
      <div className="aspect-[4/3] bg-brand-100">
        {craft.cover_photo ? (
          <img
            src={craft.cover_photo.url}
            alt={craft.cover_photo.alt_text}
            loading="lazy"
            width={400}
            height={300}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-stone-600">
            No photo yet
          </div>
        )}
      </div>
      <div className="p-4">
        <h2 className="text-lg font-semibold">
          <Link to={`/crafts/${craft.id}`} className="hover:underline">
            {craft.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-stone-700">
          {craft.craft_type.name} · {craft.category.name}
        </p>
        <p className="text-sm text-stone-600">
          {[craft.culture?.name, placeName(craft)].filter(Boolean).join(" · ")}
        </p>
        {craft.status === "hidden" && (
          <p className="mt-2 inline-block rounded bg-stone-200 px-2 py-0.5 text-xs font-medium">
            Hidden by a moderator
          </p>
        )}
      </div>
    </article>
  );
}

export function CraftGrid({ crafts }: { crafts: CraftListItem[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {crafts.map((craft) => (
        <li key={craft.id}>
          <CraftCard craft={craft} />
        </li>
      ))}
    </ul>
  );
}
