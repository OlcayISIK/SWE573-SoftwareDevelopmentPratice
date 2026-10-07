import { z } from "zod";

import { DIMENSION_KEYS, type CraftAttributes } from "../attributes";
import type { CraftDetail } from "../types";

const required = (message: string) => z.string().trim().min(1, message);

const optionalPositive = z
  .string()
  .trim()
  .refine((value) => value === "" || Number(value) > 0, "Enter a number greater than 0.");

const coordinate = (label: string, limit: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label} or pick the location on the map.`)
    .refine(
      (value) => Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit,
      `The ${label} must be between -${limit} and ${limit}.`,
    );

const commaList = (itemMax: number) =>
  z
    .string()
    .refine((value) => splitList(value).length <= 10, "List at most 10 items.")
    .refine(
      (value) => splitList(value).every((item) => item.length <= itemMax),
      `Keep each item under ${itemMax} characters.`,
    );

export const craftFormSchema = z.object({
  name: required("Enter the name of the craft.").max(150),
  craft_type: required("Enter the type of craft, for example Tile or Carpet.").max(100),
  category: required("Choose a category."),
  region: required("Choose a region."),
  latitude: coordinate("latitude", 90),
  longitude: coordinate("longitude", 180),
  description: required("Describe what the craft is."),
  production_process: required("Describe how it is made."),
  how_to_understand: required("Explain how to understand it."),
  cultural_relevance: required("Explain its cultural relevance."),
  attributes: z.object({
    dimensions_cm: z.object({
      height: optionalPositive,
      width: optionalPositive,
      depth: optionalPositive,
      length: optionalPositive,
      diameter: optionalPositive,
    }),
    weight_g: optionalPositive,
    colors: commaList(40),
    materials: commaList(60),
    distinguishing_features: z.string().max(1000),
  }),
});

export type CraftFormValues = z.infer<typeof craftFormSchema>;

/** Every field the form renders, used to place server errors next to the right input. */
export const CRAFT_FORM_FIELDS = [
  "name",
  "craft_type",
  "category",
  "region",
  "latitude",
  "longitude",
  "description",
  "production_process",
  "how_to_understand",
  "cultural_relevance",
  ...DIMENSION_KEYS.map((key) => `attributes.dimensions_cm.${key}` as const),
  "attributes.weight_g",
  "attributes.colors",
  "attributes.materials",
  "attributes.distinguishing_features",
] as const;

export const emptyCraftForm: CraftFormValues = {
  name: "",
  craft_type: "",
  category: "",
  region: "",
  latitude: "",
  longitude: "",
  description: "",
  production_process: "",
  how_to_understand: "",
  cultural_relevance: "",
  attributes: {
    dimensions_cm: { height: "", width: "", depth: "", length: "", diameter: "" },
    weight_g: "",
    colors: "",
    materials: "",
    distinguishing_features: "",
  },
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface CraftPayload {
  name: string;
  craft_type: string;
  category: number;
  region: number;
  latitude: number;
  longitude: number;
  description: string;
  production_process: string;
  how_to_understand: string;
  cultural_relevance: string;
  attributes: CraftAttributes;
}

export function toPayload(values: CraftFormValues): CraftPayload {
  const { attributes } = values;
  const dimensions = Object.fromEntries(
    DIMENSION_KEYS.filter((key) => attributes.dimensions_cm[key] !== "").map((key) => [
      key,
      Number(attributes.dimensions_cm[key]),
    ]),
  );
  const payloadAttributes: CraftAttributes = {};
  if (Object.keys(dimensions).length) payloadAttributes.dimensions_cm = dimensions;
  if (attributes.weight_g) payloadAttributes.weight_g = Number(attributes.weight_g);
  if (splitList(attributes.colors).length) payloadAttributes.colors = splitList(attributes.colors);
  if (splitList(attributes.materials).length) {
    payloadAttributes.materials = splitList(attributes.materials);
  }
  if (attributes.distinguishing_features.trim()) {
    payloadAttributes.distinguishing_features = attributes.distinguishing_features.trim();
  }

  return {
    name: values.name.trim(),
    craft_type: values.craft_type.trim(),
    category: Number(values.category),
    region: Number(values.region),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    description: values.description.trim(),
    production_process: values.production_process.trim(),
    how_to_understand: values.how_to_understand.trim(),
    cultural_relevance: values.cultural_relevance.trim(),
    attributes: payloadAttributes,
  };
}

export function fromCraft(craft: CraftDetail): CraftFormValues {
  const attributes = craft.attributes as CraftAttributes;
  const dimension = (key: (typeof DIMENSION_KEYS)[number]) =>
    attributes.dimensions_cm?.[key]?.toString() ?? "";
  return {
    name: craft.name,
    craft_type: craft.craft_type,
    category: String(craft.category.id),
    region: String(craft.region.id),
    latitude: String(craft.latitude),
    longitude: String(craft.longitude),
    description: craft.description,
    production_process: craft.production_process,
    how_to_understand: craft.how_to_understand,
    cultural_relevance: craft.cultural_relevance,
    attributes: {
      dimensions_cm: {
        height: dimension("height"),
        width: dimension("width"),
        depth: dimension("depth"),
        length: dimension("length"),
        diameter: dimension("diameter"),
      },
      weight_g: attributes.weight_g?.toString() ?? "",
      colors: attributes.colors?.join(", ") ?? "",
      materials: attributes.materials?.join(", ") ?? "",
      distinguishing_features: attributes.distinguishing_features ?? "",
    },
  };
}
