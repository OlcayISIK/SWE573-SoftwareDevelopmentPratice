/** Profiles only ever hold a general location: city and country. */
export function formatLocation(city?: string, country?: string) {
  return [city, country].filter(Boolean).join(", ");
}

const joinedFormat = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export function formatJoined(date?: string) {
  return date ? `Joined ${joinedFormat.format(new Date(date))}` : "";
}
