export const LENGTH_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export const WEIGHT_UNITS = ["g", "kg", "oz", "lb"] as const;
export const VOLUME_UNITS = ["ml", "l", "fl oz"] as const;
export const DIMENSION_UNITS = [...LENGTH_UNITS, ...WEIGHT_UNITS, ...VOLUME_UNITS] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

/** Each kind of dimension, the units it can be given in, and the unit a new row starts with. */
const LENGTH = { units: LENGTH_UNITS, unit: "cm" } as const;
export const DIMENSION_KINDS = {
  height: LENGTH,
  width: LENGTH,
  depth: LENGTH,
  length: LENGTH,
  diameter: LENGTH,
  circumference: LENGTH,
  thickness: LENGTH,
  weight: { units: WEIGHT_UNITS, unit: "g" },
  volume: { units: VOLUME_UNITS, unit: "ml" },
} as const satisfies Record<string, { units: readonly DimensionUnit[]; unit: DimensionUnit }>;
export type DimensionType = keyof typeof DIMENSION_KINDS;
export const DIMENSION_TYPES = Object.keys(DIMENSION_KINDS) as [DimensionType, ...DimensionType[]];

export function unitsFor(type: DimensionType): readonly DimensionUnit[] {
  return DIMENSION_KINDS[type].units;
}

export interface Dimension {
  type: DimensionType;
  value: number;
  unit: DimensionUnit;
}

export interface CraftAttributes {
  dimensions?: Dimension[];
  distinguishing_features?: string;
}

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

const isLength = (row: Dimension) => DIMENSION_KINDS[row.type] === LENGTH;

/** The size of the craft, e.g. "height 20 cm, width 15 cm". */
export function formatDimensions(dimensions: CraftAttributes["dimensions"]): string | null {
  const rows = (dimensions ?? []).filter(isLength);
  if (!rows.length) {
    return null;
  }
  return rows.map(({ type, value, unit }) => `${type} ${number.format(value)} ${unit}`).join(", ");
}

/** The weight or the volume of the craft, e.g. "2.5 lb". */
export function formatAmount(
  dimensions: CraftAttributes["dimensions"],
  type: "weight" | "volume",
): string | null {
  const row = dimensions?.find((item) => item.type === type);
  return row ? `${number.format(row.value)} ${row.unit}` : null;
}
