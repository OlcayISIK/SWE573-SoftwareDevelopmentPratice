/** "City, Country", or whichever of the two is known. */
export function placeName({ city, country }: { city: string; country: string }) {
  return [city, country].filter(Boolean).join(", ");
}
