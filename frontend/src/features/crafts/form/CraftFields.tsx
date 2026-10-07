import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import { SelectField } from "@/components/form/SelectField";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";

import { lookupsApi } from "../api";
import {
  useAddLookup,
  useCategories,
  useCraftTypes,
  useCultures,
  useMaterials,
  useTools,
} from "../queries";
import type { CraftDetail } from "../types";

import { AddItemInline } from "./AddItemInline";
import { DimensionRows } from "./DimensionRows";
import { ItemPicker } from "./ItemPicker";
import { LocationPicker } from "./LocationPicker";
import { MAX_MATERIALS, MAX_TOOLS, type CraftFormValues } from "./schema";

const changed = { shouldValidate: true, shouldDirty: true };

interface Option {
  id: number;
  name: string;
}

/** The list, plus the craft's current choice when it is no longer listed (an admin hid it). */
function withCurrent<T extends Option>(options: T[] | undefined, current: Option | undefined) {
  const list: Option[] = options ?? [];
  return current && !list.some((option) => option.id === current.id) ? [...list, current] : list;
}

const DESCRIPTION_HINT =
  "What it is, how it is made, how to understand it (motifs, symbols, details), and its " +
  "cultural relevance: who makes it, its role in the community, and why it matters.";

export function CraftFields({
  form,
  craft,
}: {
  form: UseFormReturn<CraftFormValues>;
  /** The craft being edited, if any. */
  craft?: CraftDetail;
}) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const category = watch("category");
  const craftType = watch("craft_type");
  const categoryId = category ? Number(category) : null;
  const craftTypeId = craftType ? Number(craftType) : null;

  const categories = useCategories();
  const craftTypes = useCraftTypes(categoryId);
  const cultures = useCultures();
  const tools = useTools(craftTypeId);
  const materials = useMaterials(craftTypeId);

  const addCategory = useAddLookup(lookupsApi.addCategory);
  const addCraftType = useAddLookup(lookupsApi.addCraftType);
  const addCulture = useAddLookup(lookupsApi.addCulture);
  const addTool = useAddLookup(lookupsApi.addTool);
  const addMaterial = useAddLookup(lookupsApi.addMaterial);

  // A craft type belongs to one category, so a new category clears it.
  const previousCategory = useRef(category);
  useEffect(() => {
    if (previousCategory.current !== category) {
      previousCategory.current = category;
      setValue("craft_type", "");
    }
  }, [category, setValue]);

  const craftTypeOptions = withCurrent(
    craftTypes.data,
    craft && String(craft.category.id) === category ? craft.craft_type : undefined,
  );
  const craftTypeName = craftTypeOptions.find((option) => String(option.id) === craftType)?.name;
  const cultureOptions = withCurrent(cultures.data, craft?.culture ?? undefined);

  // The selects below take their value from the form state, so an item added a moment ago
  // shows as chosen as soon as its option is rendered.
  return (
    <div className="space-y-10">
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Basics</legend>
        <TextField label="Name" error={errors.name?.message} {...register("name")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SelectField
              label="Category"
              error={errors.category?.message}
              {...register("category")}
              value={category}
            >
              <option value="">Choose a category</option>
              {categories.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SelectField>
            <AddItemInline
              noun="category"
              onAdd={async (name) => {
                const added = await addCategory.mutateAsync([name]);
                setValue("category", String(added.id), changed);
              }}
            />
          </div>
          <div>
            <SelectField
              label="Craft type"
              disabled={!categoryId}
              error={errors.craft_type?.message}
              {...register("craft_type")}
              value={craftType}
            >
              <option value="">
                {categoryId ? "Choose a craft type" : "Choose a category first"}
              </option>
              {craftTypeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SelectField>
            <AddItemInline
              noun="craft type"
              disabled={!categoryId}
              disabledHint="Choose a category to add a craft type to it."
              onAdd={async (name) => {
                const added = await addCraftType.mutateAsync([name, categoryId as number]);
                setValue("craft_type", String(added.id), changed);
              }}
            />
          </div>
        </div>
        <div>
          <SelectField
            label="Culture"
            error={errors.culture?.message}
            {...register("culture")}
            value={watch("culture")}
          >
            <option value="">Choose the culture it belongs to</option>
            {cultureOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {"homeland" in option && option.homeland
                  ? `${option.name} (${option.homeland})`
                  : option.name}
              </option>
            ))}
          </SelectField>
          <AddItemInline
            noun="culture"
            withHomeland
            onAdd={async (name, homeland) => {
              const added = await addCulture.mutateAsync([name, homeland]);
              setValue("culture", String(added.id), changed);
            }}
          />
        </div>
      </fieldset>

      <LocationPicker form={form} />

      <fieldset className="space-y-6">
        <legend className="text-lg font-semibold">Tools and materials</legend>
        <ItemPicker
          label="Tools"
          noun="tool"
          items={tools.data}
          value={watch("tools")}
          onChange={(value) => setValue("tools", value, changed)}
          onCreate={(name) => addTool.mutateAsync([name, craftTypeId ?? undefined])}
          craftTypeName={craftTypeName}
          max={MAX_TOOLS}
          error={errors.tools?.message}
        />
        <ItemPicker
          label="Materials"
          noun="material"
          items={materials.data}
          value={watch("materials")}
          onChange={(value) => setValue("materials", value, changed)}
          onCreate={(name) => addMaterial.mutateAsync([name, craftTypeId ?? undefined])}
          craftTypeName={craftTypeName}
          max={MAX_MATERIALS}
          error={errors.materials?.message}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Description</legend>
        <TextAreaField
          label="About this craft"
          hint={DESCRIPTION_HINT}
          rows={12}
          error={errors.description?.message}
          {...register("description")}
        />
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="text-lg font-semibold">Characteristics (optional)</legend>
        <p className="text-sm text-stone-600">Fill in only what applies to this craft.</p>
        <DimensionRows form={form} />
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
