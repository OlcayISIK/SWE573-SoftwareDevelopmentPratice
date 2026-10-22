import type { Path } from "react-hook-form";
import { z } from "zod";

import {
  DIMENSION_TYPES,
  DIMENSION_UNITS,
  unitsFor,
  type CraftAttributes,
  type DimensionType,
} from "../attributes";
import { parseColor, toStoredColor } from "../colors";
import type { CraftDetail } from "../types";

export const MAX_TOOLS = 20;
export const MAX_MATERIALS = 20;
export const MAX_COLORS = 10;
export const MAX_PLACES = 10;

const required = (message: string) => z.string().trim().min(1, message);

const positive = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number(value) > 0, "Enter a number greater than 0.");

const PIN_MESSAGE = "Pin the location: use Pin address or click the map.";

const coordinate = (limit: number) =>
  z
    .string()
    .trim()
    .min(1, PIN_MESSAGE)
    .refine(
      (value) => Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit,
      PIN_MESSAGE,
    );

const chosenItem = z.object({ id: z.number(), name: z.string() });

const place = z.object({
  address: required("Enter the address of this place.").max(255),
  city: z.string(),
  country: z.string(),
  latitude: coordinate(90),
  longitude: coordinate(180),
});

const color = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Pick a color or type its code.")
    .refine(
      (value) => parseColor(value) !== null,
      "Use a hex code (#1e40af), rgb(), hsl(), or a color name.",
    ),
});

const dimension = z
  .object({
    type: z.enum(DIMENSION_TYPES),
    value: positive("Enter the amount."),
    unit: z.enum(DIMENSION_UNITS),
  })
  .refine((row) => unitsFor(row.type).includes(row.unit), {
    path: ["unit"],
    message: "Pick a unit for this measure.",
  });

export const craftFormSchema = z.object({
  name: required("Enter the name of the craft.").max(150),
  category: required("Choose a category."),
  craft_type: required("Choose a craft type."),
  culture: required("Choose the culture the craft belongs to."),
  tools: z.array(chosenItem).max(MAX_TOOLS, `Choose at most ${MAX_TOOLS} tools.`),
  materials: z.array(chosenItem).max(MAX_MATERIALS, `Choose at most ${MAX_MATERIALS} materials.`),
  places: z
    .array(place)
    .min(1, "Add the place the craft comes from.")
    .max(MAX_PLACES, `Add at most ${MAX_PLACES} places.`)
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        if (!row.latitude || !row.longitude) return;
        const point = `${Number(row.latitude).toFixed(6)},${Number(row.longitude).toFixed(6)}`;
        if (seen.has(point)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "address"],
            message: "This place is already listed.",
          });
        }
        seen.add(point);
      });
    }),
  /** The index of the place that is the origin, or "" when all places are equal. */
  origin: z.string(),
  description: required("Describe the craft."),
  story: z.string(),
  colors: z
    .array(color)
    .max(MAX_COLORS, `Add at most ${MAX_COLORS} colors.`)
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const hex = parseColor(row.code)?.hex;
        if (!hex) return;
        if (seen.has(hex)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "code"],
            message: "This color is already listed.",
          });
        }
        seen.add(hex);
      });
    }),
  date: z
    .object({
      kind: z.enum(["unknown", "year", "day"]),
      year: z.string(),
      era: z.enum(["ad", "bc"]),
      circa: z.boolean(),
      day: z.string(),
    })
    .superRefine((date, context) => {
      if (date.kind === "year") {
        const year = Number(date.year.trim());
        if (!date.year.trim() || !Number.isInteger(year) || year < 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["year"],
            message: "Enter the year as a whole number, such as 500.",
          });
        } else if (date.era === "ad" && year > new Date().getFullYear()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["year"],
            message: "The year cannot be in the future.",
          });
        }
      }
      if (date.kind === "day") {
        if (!date.day) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["day"],
            message: "Enter the date.",
          });
        } else if (date.day > new Date().toISOString().slice(0, 10)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["day"],
            message: "The date cannot be in the future.",
          });
        }
      }
    }),
  attributes: z.object({
    dimensions: z.array(dimension).superRefine((rows, context) => {
      const seen = new Set<DimensionType>();
      rows.forEach((row, index) => {
        if (seen.has(row.type)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "type"],
            message: "This dimension is already entered.",
          });
        }
        seen.add(row.type);
      });
    }),
    distinguishing_features: z.string().max(1000),
  }),
});

export type CraftFormValues = z.infer<typeof craftFormSchema>;
export type DimensionRow = CraftFormValues["attributes"]["dimensions"][number];
export type ChosenItem = z.infer<typeof chosenItem>;
export type ColorRow = CraftFormValues["colors"][number];
export type PlaceRow = CraftFormValues["places"][number];

const PLACE_FIELDS = Array.from({ length: MAX_PLACES }, (_, index) =>
  (["address", "latitude", "longitude"] as const).map(
    (field) => `places.${index}.${field}` as const,
  ),
).flat();

/** Every field the form renders, used to place server errors next to the right input. */
export const CRAFT_FORM_FIELDS: readonly Path<CraftFormValues>[] = [
  "name",
  "category",
  "craft_type",
  "culture",
  "tools",
  "materials",
  "places",
  ...PLACE_FIELDS,
  "description",
  "story",
  "date",
  "date.year",
  "date.day",
  "colors",
  "attributes.dimensions",
  "attributes.distinguishing_features",
];

export const emptyPlace: PlaceRow = {
  address: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
};

export const emptyCraftForm: CraftFormValues = {
  name: "",
  category: "",
  craft_type: "",
  culture: "",
  tools: [],
  materials: [],
  places: [emptyPlace],
  origin: "",
  description: "",
  story: "",
  date: { kind: "unknown", year: "", era: "ad", circa: false, day: "" },
  colors: [],
  attributes: {
    dimensions: [],
    distinguishing_features: "",
  },
};

export const newDimension: DimensionRow = { type: "height", value: "", unit: "cm" };

export interface CraftPayload {
  name: string;
  category: number;
  craft_type: number;
  culture: number;
  tools: number[];
  materials: number[];
  places: {
    address: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    is_origin: boolean;
  }[];
  description: string;
  story: string;
  date:
    | { kind: "unknown" }
    | { kind: "year"; year: number; circa: boolean }
    | { kind: "day"; day: string };
  colors: string[];
  attributes: CraftAttributes;
}

/** Years before the common era are sent as negative numbers, so 500 BC is -500. */
function toDatePayload(date: CraftFormValues["date"]): CraftPayload["date"] {
  if (date.kind === "year") {
    const year = Number(date.year.trim());
    return { kind: "year", year: date.era === "bc" ? -year : year, circa: date.circa };
  }
  if (date.kind === "day") return { kind: "day", day: date.day };
  return { kind: "unknown" };
}

export function toPayload(values: CraftFormValues): CraftPayload {
  const { attributes } = values;
  const payloadAttributes: CraftAttributes = {};
  if (attributes.dimensions.length) {
    payloadAttributes.dimensions = attributes.dimensions.map((row) => ({
      ...row,
      value: Number(row.value),
    }));
  }
  if (attributes.distinguishing_features.trim()) {
    payloadAttributes.distinguishing_features = attributes.distinguishing_features.trim();
  }

  return {
    name: values.name.trim(),
    category: Number(values.category),
    craft_type: Number(values.craft_type),
    culture: Number(values.culture),
    tools: values.tools.map((item) => item.id),
    materials: values.materials.map((item) => item.id),
    places: values.places.map((row, index) => ({
      address: row.address.trim(),
      city: row.city,
      country: row.country,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      is_origin: String(index) === values.origin,
    })),
    description: values.description.trim(),
    story: values.story.trim(),
    date: toDatePayload(values.date),
    colors: values.colors.map((row) => toStoredColor(parseColor(row.code)!)),
    attributes: payloadAttributes,
  };
}

export function fromCraft(craft: CraftDetail): CraftFormValues {
  const attributes = craft.attributes as CraftAttributes;
  const chosen = ({ id, name }: { id: number; name: string }) => ({ id, name });
  return {
    name: craft.name,
    category: String(craft.category.id),
    craft_type: String(craft.craft_type.id),
    culture: craft.culture ? String(craft.culture.id) : "",
    tools: craft.tools.map(chosen),
    materials: craft.materials.map(chosen),
    places: craft.places.map((row) => ({
      address: row.address,
      city: row.city,
      country: row.country,
      latitude: String(row.latitude),
      longitude: String(row.longitude),
    })),
    origin: String(craft.places.findIndex((row) => row.is_origin)).replace("-1", ""),
    description: craft.description,
    story: craft.story,
    date: {
      kind: craft.date.kind,
      year: craft.date.year ? String(Math.abs(craft.date.year)) : "",
      era: (craft.date.year ?? 0) < 0 ? "bc" : "ad",
      circa: craft.date.circa,
      day: craft.date.day ?? "",
    },
    colors: craft.colors.map((code) => ({ code })),
    attributes: {
      dimensions: (attributes.dimensions ?? []).map((row) => ({
        ...row,
        value: String(row.value),
      })),
      distinguishing_features: attributes.distinguishing_features ?? "",
    },
  };
}
