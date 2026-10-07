import { useEffect, useRef } from "react";
import { Link } from "react-router";

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
      className="fixed inset-x-0 bottom-0 z-[1100] rounded-t-xl border border-brand-100 bg-white p-4 shadow-lg md:absolute md:inset-x-auto md:bottom-auto md:right-4 md:top-4 md:w-80 md:rounded-xl"
    >
      <div className="flex justify-end">
        <button
          ref={closeRef}
          type="button"
          aria-label="Close preview"
          className="rounded px-2 text-lg"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {craft.isPending ? (
        <p role="status">Loading…</p>
      ) : craft.isError ? (
        <p role="alert">This craft could not be loaded.</p>
      ) : (
        <>
          {photo?.file && (
            <img
              src={photo.file}
              alt={photo.alt_text}
              width={320}
              height={180}
              className="mb-3 h-40 w-full rounded object-cover"
            />
          )}
          <h2 className="text-lg font-semibold">{craft.data.name}</h2>
          <p className="text-sm text-stone-700">
            {craft.data.craft_type.name} · {craft.data.category.name}
          </p>
          <p className="text-sm text-stone-600">
            {[craft.data.culture?.name, placeName(craft.data)].filter(Boolean).join(" · ")}
          </p>
          <Link
            to={`/crafts/${craft.data.id}`}
            className="mt-3 inline-block font-medium text-brand-700 underline"
          >
            View details
          </Link>
        </>
      )}
    </aside>
  );
}
