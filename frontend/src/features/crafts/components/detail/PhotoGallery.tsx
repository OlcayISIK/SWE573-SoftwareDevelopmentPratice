import { useState } from "react";

import type { CraftMedia } from "../../types";

export function PhotoGallery({ photos }: { photos: CraftMedia[] }) {
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, photos.length - 1)];

  if (!current?.file) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-brand-100 text-stone-600">
        No photos yet
      </div>
    );
  }

  return (
    <div>
      <figure>
        <img
          src={current.file}
          alt={current.alt_text}
          width={800}
          height={600}
          className="aspect-[4/3] w-full rounded-lg bg-brand-100 object-cover"
        />
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
                className={`overflow-hidden rounded border-2 ${
                  photoIndex === index ? "border-brand-700" : "border-transparent"
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
    </div>
  );
}
