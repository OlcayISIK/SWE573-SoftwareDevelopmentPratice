import type { UseFormReturn } from "react-hook-form";

import { SelectField } from "@/components/form/SelectField";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";

import { useCategories, useRegions } from "../queries";
import type { Region } from "../types";

import { LocationPicker } from "./LocationPicker";
import type { CraftFormValues } from "./schema";

function byCountry(regions: Region[]) {
  const groups = new Map<string, Region[]>();
  regions.forEach((region) =>
    groups.set(region.country, [...(groups.get(region.country) ?? []), region]),
  );
  return [...groups.entries()];
}

export function CraftFields({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    register,
    formState: { errors },
  } = form;
  const categories = useCategories();
  const regions = useRegions();
  const dims = errors.attributes?.dimensions_cm;

  return (
    <div className="space-y-10">
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Basics</legend>
        <TextField label="Name" error={errors.name?.message} {...register("name")} />
        <TextField
          label="Type of craft"
          hint="For example: tile, carpet, basket, mask."
          error={errors.craft_type?.message}
          {...register("craft_type")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" error={errors.category?.message} {...register("category")}>
            <option value="">Choose a category</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Region" error={errors.region?.message} {...register("region")}>
            <option value="">Choose a region</option>
            {byCountry(regions.data ?? []).map(([country, items]) => (
              <optgroup key={country} label={country}>
                {items.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <LocationPicker form={form} />

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Description</legend>
        <TextAreaField
          label="What it is"
          error={errors.description?.message}
          {...register("description")}
        />
        <TextAreaField
          label="How it is made"
          hint="Materials, tools, and the steps of making it."
          error={errors.production_process?.message}
          {...register("production_process")}
        />
        <TextAreaField
          label="How to understand it"
          hint="Motifs, symbols, or details that help people read the craft."
          error={errors.how_to_understand?.message}
          {...register("how_to_understand")}
        />
        <TextAreaField
          label="Cultural relevance"
          hint="Who makes it, its role in the community, and why it matters."
          error={errors.cultural_relevance?.message}
          {...register("cultural_relevance")}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Characteristics (optional)</legend>
        <p className="text-sm text-stone-600">Fill in only what applies to this craft.</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(["height", "width", "depth", "length", "diameter"] as const).map((key) => (
            <TextField
              key={key}
              label={`${key[0].toUpperCase()}${key.slice(1)} (cm)`}
              inputMode="decimal"
              error={dims?.[key]?.message}
              {...register(`attributes.dimensions_cm.${key}`)}
            />
          ))}
        </div>
        <TextField
          label="Weight (g)"
          inputMode="decimal"
          className="sm:w-48"
          error={errors.attributes?.weight_g?.message}
          {...register("attributes.weight_g")}
        />
        <TextField
          label="Colors"
          hint="Separate with commas, for example: cobalt blue, turquoise."
          error={errors.attributes?.colors?.message}
          {...register("attributes.colors")}
        />
        <TextField
          label="Materials"
          hint="Separate with commas, for example: wool, natural dyes."
          error={errors.attributes?.materials?.message}
          {...register("attributes.materials")}
        />
        <TextAreaField
          label="Distinguishing features"
          rows={3}
          error={errors.attributes?.distinguishing_features?.message}
          {...register("attributes.distinguishing_features")}
        />
      </fieldset>
    </div>
  );
}
