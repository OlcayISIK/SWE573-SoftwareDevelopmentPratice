import { useId, useState } from "react";

import { TextField } from "@/components/form/TextField";

import type { NewMedia } from "../api";

const MB = 1024 * 1024;
export const PHOTO_MAX_BYTES = 5 * MB;
export const DOCUMENT_MAX_BYTES = 10 * MB;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type MediaType = NewMedia["media_type"];
type Errors = Partial<Record<"file" | "url" | "alt_text", string>>;

function validate(type: MediaType, file: File | null, url: string, altText: string): Errors {
  if (type === "video") {
    if (!url.trim()) return { url: "Enter a link to the video." };
    try {
      const parsed = new URL(url.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      return { url: "Enter a full web link, for example https://www.youtube.com/watch?v=…" };
    }
    return {};
  }
  if (!file) return { file: "Choose a file." };
  if (type === "photo") {
    const errors: Errors = {};
    if (!PHOTO_TYPES.includes(file.type)) errors.file = "Use a JPEG, PNG, or WebP image.";
    else if (file.size > PHOTO_MAX_BYTES) errors.file = "Photos must be 5 MB or smaller.";
    if (!altText.trim()) errors.alt_text = "Describe the photo for people who cannot see it.";
    return errors;
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) return { file: "Use a PDF document." };
  if (file.size > DOCUMENT_MAX_BYTES) return { file: "Documents must be 10 MB or smaller." };
  return {};
}

export function MediaPicker({ onAdd }: { onAdd: (media: NewMedia) => void }) {
  const id = useId();
  const [type, setType] = useState<MediaType>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [url, setUrl] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const reset = () => {
    setFile(null);
    setFileKey((key) => key + 1);
    setUrl("");
    setAltText("");
    setCaption("");
    setErrors({});
  };

  const add = () => {
    const found = validate(type, file, url, altText);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (type === "video") onAdd({ media_type: "video", url: url.trim(), caption: caption.trim() });
    else if (type === "photo")
      onAdd({
        media_type: "photo",
        file: file!,
        alt_text: altText.trim(),
        caption: caption.trim(),
      });
    else onAdd({ media_type: "document", file: file!, caption: caption.trim() });
    reset();
  };

  return (
    <fieldset className="space-y-4 rounded border border-stone-300 p-4">
      <legend className="px-1 font-medium">Add a photo, video, or document</legend>
      <div role="radiogroup" aria-label="Media type" className="flex flex-wrap gap-4">
        {(
          [
            ["photo", "Photo"],
            ["video", "Video link"],
            ["document", "PDF document"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${id}-type`}
              value={value}
              checked={type === value}
              onChange={() => {
                setType(value);
                reset();
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {type === "video" ? (
        <TextField
          label="Video URL"
          type="url"
          hint="YouTube and Vimeo links are shown as embedded players."
          value={url}
          error={errors.url}
          onChange={(event) => setUrl(event.target.value)}
        />
      ) : (
        <TextField
          key={fileKey}
          label={type === "photo" ? "Photo file" : "PDF file"}
          type="file"
          accept={type === "photo" ? PHOTO_TYPES.join(",") : "application/pdf,.pdf"}
          hint={type === "photo" ? "JPEG, PNG, or WebP, up to 5 MB." : "PDF, up to 10 MB."}
          error={errors.file}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      )}
      {type === "photo" && (
        <TextField
          label="Alt text"
          hint="Describe what the photo shows, for people using screen readers."
          value={altText}
          error={errors.alt_text}
          onChange={(event) => setAltText(event.target.value)}
        />
      )}
      <TextField
        label="Caption (optional)"
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
      />
      <button
        type="button"
        className="rounded border border-brand-700 px-4 py-2 font-medium text-brand-700 hover:bg-brand-100"
        onClick={add}
      >
        Add to craft
      </button>
    </fieldset>
  );
}
