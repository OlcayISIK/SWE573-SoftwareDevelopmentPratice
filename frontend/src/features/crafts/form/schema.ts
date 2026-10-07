import { z } from "zod";

import {
  DIMENSION_TYPES,
  DIMENSION_UNITS,
  type CraftAttributes,
  type DimensionType,
} from "../attributes";
import type { CraftDetail } from "../types";

export const MAX_TOOLS = 20;
export const MAX_MATERIALS = 20;

const required = (message: string) => z.string().trim().min(1, message);

const positive = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => Number(value) > 0, "Enter a number greater than 0.");

const optionalPositive = z
  .string()
  .trim()
  .refine((value) => value === "" || Number(value) > 0, "Enter a number greater than 0.");

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

const commaList = (itemMax: number) =>
  z
    .string()
    .refine((value) => splitList(value).length <= 10, "List at most 10 items.")
    .refine(
      (value) => splitList(value).every((item) => item.length <= itemMax),
      `Keep each item under ${itemMax} characters.`,
    );

const chosenItem = z.object({ id: z.number(), name: z.string() });

const dimension = z.object({
  type: z.enum(DIMENSION_TYPES),
  value: positive("Enter the size."),
  unit: z.enum(DIMENSION_UNITS),
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
    weight_g: optionalPositive,
    colors: commaList(40),
    distinguishing_features: z.string().max(1000),
  }),
});

export type CraftFormValues = z.infer<typeof craftFormSchema>;
export type DimensionRow = CraftFormValues["attributes"]["dimensions"][number];
export type ChosenItem = z.infer<typeof chosenItem>;

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
  "attributes.dimensions",
  "attributes.weight_g",
  "attributes.colors",
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
  attributes: {
    dimensions: [],
    weight_g: "",
    colors: "",
    distinguishing_features: "",
  },
};

export const newDimension: DimensionRow = { type: "height", value: "", unit: "cm" };

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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
  if (attributes.weight_g) payloadAttributes.weight_g = Number(attributes.weight_g);
  if (splitList(attributes.colors).length) payloadAttributes.colors = splitList(attributes.colors);
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
    attributes: {
      dimensions: (attributes.dimensions ?? []).map((row) => ({
        ...row,
        value: String(row.value),
      })),
      weight_g: attributes.weight_g?.toString() ?? "",
      colors: attributes.colors?.join(", ") ?? "",
      distinguishing_features: attributes.distinguishing_features ?? "",
    },
  };
}
