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
  address: required("Enter the address the craft comes from.").max(255),
  city: z.string(),
  country: z.string(),
  latitude: coordinate(90),
  longitude: coordinate(180),
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

/** Every field the form renders, used to place server errors next to the right input. */
export const CRAFT_FORM_FIELDS = [
  "name",
  "category",
  "craft_type",
  "culture",
  "tools",
  "materials",
  "address",
  "latitude",
  "longitude",
  "description",
  "story",
  "colors",
  "attributes.dimensions",
  "attributes.distinguishing_features",
] as const;

export const emptyCraftForm: CraftFormValues = {
  name: "",
  category: "",
  craft_type: "",
  culture: "",
  tools: [],
  materials: [],
  address: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  description: "",
  story: "",
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
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  description: string;
  story: string;
  colors: string[];
  attributes: CraftAttributes;
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
    address: values.address.trim(),
    city: values.city,
    country: values.country,
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    description: values.description.trim(),
    story: values.story.trim(),
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
    address: craft.address,
    city: craft.city,
    country: craft.country,
    latitude: String(craft.latitude),
    longitude: String(craft.longitude),
    description: craft.description,
    story: craft.story,
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
