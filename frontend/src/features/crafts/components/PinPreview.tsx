import { ArrowRight, MapPin, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { categoryStyle } from "../categoryStyle";
import { placeName } from "../place";
import { useCraft } from "../queries";

export function PinPreview({ craftId, onClose }: { craftId: number; onClose: () => void }) {
  const craft = useCraft(craftId);
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = craft.data?.media.find((item) => item.media_type === "photo");

  useEffect(() => {
    closeRef.current?.focus();
  }, [craftId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      aria-label="Craft preview"
      className="animate-slide-up fixed inset-x-0 bottom-0 z-[1100] overflow-hidden rounded-t-2xl bg-white shadow-xl ring-1 ring-stone-200 md:absolute md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:w-80 md:rounded-xl"
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close preview"
        className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-stone-700 shadow-md backdrop-blur hover:bg-white hover:text-deep-sea"
        onClick={onClose}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
      {craft.isPending ? (
        <div role="status" className="space-y-3 p-4">
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
          <span className="sr-only">Loading…</span>
        </div>
      ) : craft.isError ? (
        <p role="alert" className="p-4 pr-12">
          This craft could not be loaded.
        </p>
      ) : (
        <>
          {photo?.file ? (
            <img
              src={photo.file}
              alt={photo.alt_text}
              width={320}
              height={180}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="h-4" />
          )}
          <div className="p-4">
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: categoryStyle(craft.data.category.slug).color }}
            >
              {craft.data.craft_type.name} · {craft.data.category.name}
            </p>
            <h2 className="mt-1 pr-8 text-xl font-semibold">{craft.data.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-600">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {[craft.data.culture?.name, placeName(craft.data)].filter(Boolean).join(" · ")}
            </p>
            <Link to={`/crafts/${craft.data.id}`} className="btn-primary mt-4 w-full">
              View details
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </aside>
  );
}
