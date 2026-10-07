export interface CraftAttributes {
  dimensions_cm?: Partial<Record<DimensionKey, number>>;
  weight_g?: number;
  colors?: string[];
  materials?: string[];
  distinguishing_features?: string;
}

export const DIMENSION_KEYS = ["height", "width", "depth", "length", "diameter"] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatDimensions(dimensions: CraftAttributes["dimensions_cm"]): string | null {
  const entries = DIMENSION_KEYS.filter((key) => dimensions?.[key] !== undefined).map(
    (key) => [key, dimensions![key]!] as const,
  );
  if (entries.length === 0) {
    return null;
  }
  return entries.map(([key, value]) => `${key} ${number.format(value)} cm`).join(", ");
}

export function formatWeight(grams: number | undefined): string | null {
  if (grams === undefined) {
    return null;
  }
  return grams >= 1000 ? `${number.format(grams / 1000)} kg` : `${number.format(grams)} g`;
}
