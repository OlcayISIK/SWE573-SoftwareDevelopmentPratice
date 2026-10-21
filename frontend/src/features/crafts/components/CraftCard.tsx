import { ImageOff, MapPin } from "lucide-react";
import { Link } from "react-router";

import { categoryStyle } from "../categoryStyle";
import { placeName } from "../place";
import type { CraftListItem } from "../types";

export function CraftCard({ craft }: { craft: CraftListItem }) {
  const { icon: Icon, color } = categoryStyle(craft.category.slug, craft.category.icon);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-sky-wash">
        {craft.cover_photo ? (
          <img
            src={craft.cover_photo.url}
            alt={craft.cover_photo.alt_text}
            loading="lazy"
            width={400}
            height={300}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="bg-contour flex h-full flex-col items-center justify-center gap-2 text-sm text-stone-600">
            <ImageOff aria-hidden="true" className="h-6 w-6" />
            No photo yet
          </div>
        )}
        <span
          className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur"
          style={{ color }}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {craft.category.name}
        </span>
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {craft.craft_type.name} · {craft.category.name}
        </p>
        <h2 className="mt-1 text-xl font-semibold leading-snug">
          {/* The whole card is clickable through the link's stretched area. */}
          <Link
            to={`/crafts/${craft.id}`}
            className="after:absolute after:inset-0 after:content-[''] group-hover:text-brand-700"
          >
            {craft.name}
          </Link>
        </h2>
        <p className="mt-auto flex items-center gap-1.5 pt-3 text-sm text-stone-600">
          <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
          {[craft.culture?.name, placeName(craft)].filter(Boolean).join(" · ")}
        </p>
        {craft.status === "hidden" && (
          <p className="mt-2 inline-block w-fit rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium">
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
      {crafts.map((craft, index) => (
        <li
          key={craft.id}
          className="animate-fade-up"
          // Cards appear one after another.
          style={{ animationDelay: `${Math.min(index, 11) * 40}ms` }}
        >
          <CraftCard craft={craft} />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder cards while the crafts load. */
export function CraftGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-xl bg-white ring-1 ring-stone-200">
          <div className="skeleton aspect-[4/3] !rounded-none" />
          <div className="space-y-3 p-4">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}
