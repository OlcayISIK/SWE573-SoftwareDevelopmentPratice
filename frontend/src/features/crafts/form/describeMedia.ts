import type { NewMedia } from "../api";

export function describeMedia(media: NewMedia) {
  if (media.media_type === "video") return `Video: ${media.caption || media.url}`;
  if (media.media_type === "photo") return `Photo: ${media.alt_text}`;
  return `Document: ${media.caption || media.file.name}`;
}
