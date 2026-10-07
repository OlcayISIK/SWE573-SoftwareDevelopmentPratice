import { toEmbedUrl } from "../../media";
import type { CraftMedia } from "../../types";

export function Videos({ videos, craftName }: { videos: CraftMedia[]; craftName: string }) {
  if (videos.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="videos-heading" className="mt-10">
      <h2 id="videos-heading" className="text-xl font-semibold">
        Videos
      </h2>
      <ul className="mt-4 space-y-6">
        {videos.map((video) => {
          const embed = toEmbedUrl(video.url);
          const label = video.caption || `Video about ${craftName}`;
          return (
            <li key={video.id}>
              {embed ? (
                <figure>
                  <iframe
                    src={embed}
                    title={label}
                    className="aspect-video w-full rounded-lg"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                  {video.caption && (
                    <figcaption className="mt-2 text-sm text-stone-600">{video.caption}</figcaption>
                  )}
                </figure>
              ) : (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline"
                >
                  {label} (opens in a new tab)
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Documents({ documents }: { documents: CraftMedia[] }) {
  if (documents.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="documents-heading" className="mt-10">
      <h2 id="documents-heading" className="text-xl font-semibold">
        Sources and documents
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-6">
        {documents.map((document, index) => (
          <li key={document.id}>
            <a
              href={document.file ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-700 underline"
            >
              {document.caption || `Document ${index + 1}`} (PDF, opens in a new tab)
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
