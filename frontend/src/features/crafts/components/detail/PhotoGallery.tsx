import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CraftMedia } from "../../types";

/** The photos full screen. Arrow keys move between them, and Escape closes. */
function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: CraftMedia[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const step = useCallback(
    (by: number) => onIndex((index + by + photos.length) % photos.length),
    [index, onIndex, photos.length],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, step]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="animate-fade-in fixed inset-0 z-[1700] flex flex-col bg-deep-sea/95 p-4 backdrop-blur"
    >
      <div className="flex items-center justify-between text-sm text-stone-300">
        <span>
          {index + 1} / {photos.length}
        </span>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close photo viewer"
          className="rounded-full p-2 text-white hover:bg-white/10"
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </button>
      </div>
      <figure className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <img
          key={photo.id}
          src={photo.file ?? ""}
          alt={photo.alt_text}
          className="animate-fade-in max-h-[80vh] max-w-full rounded-lg object-contain shadow-xl"
        />
        {photo.caption && (
          <figcaption className="max-w-2xl text-center text-sm text-stone-300">
            {photo.caption}
          </figcaption>
        )}
      </figure>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden="true" className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            onClick={() => step(1)}
          >
            <ChevronRight aria-hidden="true" className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  );
}

export function PhotoGallery({ photos }: { photos: CraftMedia[] }) {
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const current = photos[Math.min(index, photos.length - 1)];

  if (!current?.file) {
    return (
      <div className="bg-contour flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl bg-white text-stone-600 ring-1 ring-stone-200">
        <ImageOff aria-hidden="true" className="h-7 w-7" />
        No photos yet
      </div>
    );
  }

  return (
    <div>
      <figure>
        <button
          type="button"
          aria-label="View photos full screen"
          className="group relative block w-full overflow-hidden rounded-xl bg-sky-wash shadow-md ring-1 ring-stone-200"
          onClick={() => setViewing(true)}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
            style={{ backgroundImage: `url("${current.file}")` }}
          />
          <img
            key={current.id}
            src={current.file}
            alt={current.alt_text}
            width={800}
            height={600}
            className="animate-fade-in relative aspect-[4/3] w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-deep-sea opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />
            Full screen
          </span>
        </button>
        {current.caption && (
          <figcaption className="mt-2 text-sm text-stone-600">{current.caption}</figcaption>
        )}
      </figure>
      {photos.length > 1 && (
        <ul aria-label="Photos" className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo, photoIndex) => (
            <li key={photo.id}>
              <button
                type="button"
                aria-label={`Show photo ${photoIndex + 1}: ${photo.alt_text}`}
                aria-pressed={photoIndex === index}
                className={`overflow-hidden rounded-sm ring-2 ring-offset-2 ring-offset-mist transition-all ${
                  photoIndex === index
                    ? "ring-brand-700"
                    : "opacity-75 ring-transparent hover:opacity-100"
                }`}
                onClick={() => setIndex(photoIndex)}
              >
                <img
                  src={photo.file ?? ""}
                  alt=""
                  width={80}
                  height={60}
                  loading="lazy"
                  className="h-15 w-20 object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {viewing && (
        <Lightbox
          photos={photos}
          index={index}
          onIndex={setIndex}
          onClose={() => setViewing(false)}
        />
      )}
    </div>
  );
}
