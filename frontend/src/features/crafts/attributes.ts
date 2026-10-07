export const DIMENSION_TYPES = [
  "height",
  "width",
  "depth",
  "length",
  "diameter",
  "thickness",
] as const;
export type DimensionType = (typeof DIMENSION_TYPES)[number];

export const DIMENSION_UNITS = ["mm", "cm", "m"] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export interface Dimension {
  type: DimensionType;
  value: number;
  unit: DimensionUnit;
}

export interface CraftAttributes {
  dimensions?: Dimension[];
  weight_g?: number;
  colors?: string[];
  distinguishing_features?: string;
}

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

export function formatDimensions(dimensions: CraftAttributes["dimensions"]): string | null {
  if (!dimensions?.length) {
    return null;
  }
  return dimensions
    .map(({ type, value, unit }) => `${type} ${number.format(value)} ${unit}`)
    .join(", ");
}

export function formatWeight(grams: number | undefined): string | null {
  if (grams === undefined) {
    return null;
  }
  return grams >= 1000 ? `${number.format(grams / 1000)} kg` : `${number.format(grams)} g`;
}
