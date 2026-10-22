import { useEffect, useRef } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { DescribedSelect } from "@/components/form/DescribedSelect";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";

import { lookupsApi } from "../api";
import { categoryStyle } from "../categoryStyle";
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
import { ColorRows } from "./ColorRows";
import { DateFields } from "./DateFields";
import { DimensionRows } from "./DimensionRows";
import { ItemPicker } from "./ItemPicker";
import { LocationPicker } from "./LocationPicker";
import { MAX_MATERIALS, MAX_TOOLS, type CraftFormValues } from "./schema";

const changed = { shouldValidate: true, shouldDirty: true };

interface Option {
  id: number;
  name: string;
  description?: string;
}

/** The list, plus the craft's current choice when it is no longer listed (an admin hid it). */
function withCurrent<T extends Option>(options: T[] | undefined, current: Option | undefined) {
  const list: Option[] = options ?? [];
  return current && !list.some((option) => option.id === current.id) ? [...list, current] : list;
}

const DESCRIPTION_HINT =
  "What the craft is and how it is made: its parts, materials, steps, and finish.";
const STORY_HINT =
  "How to understand it and why it matters: its history, the meaning of its motifs and " +
  "symbols, who makes it, and its role in the community.";

export function CraftFields({
  form,
  craft,
}: {
  form: UseFormReturn<CraftFormValues>;
  /** The craft being edited, if any. */
  craft?: CraftDetail;
}) {
  const {
    control,
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
  const chosenCraftType = craftTypeOptions.find((option) => String(option.id) === craftType);
  const craftTypeName = chosenCraftType?.name;
  const cultureOptions = withCurrent(cultures.data, craft?.culture ?? undefined);
  const culture = watch("culture");
  const chosenCategory = categories.data?.find((option) => String(option.id) === category);
  const chosenCulture = cultureOptions.find((option) => String(option.id) === culture);

  // The lists below take their value from the form state, so an item added a moment ago
  // shows as chosen as soon as it is listed.
  return (
    <div className="space-y-6">
      <fieldset id="section-basics" className="form-section space-y-4">
        <legend>Basics</legend>
        <TextField label="Name" error={errors.name?.message} {...register("name")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <DescribedSelect
                  ref={field.ref}
                  label="Category"
                  placeholder="Choose a category"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hint={chosenCategory?.description || undefined}
                  error={errors.category?.message}
                  options={(categories.data ?? []).map((option) => {
                    const { icon: Icon, color } = categoryStyle(option.slug, option.icon);
                    return {
                      value: String(option.id),
                      label: option.name,
                      description: option.description,
                      icon: <Icon aria-hidden="true" className="h-4 w-4" style={{ color }} />,
                    };
                  })}
                />
              )}
            />
            <AddItemInline
              noun="category"
              withIcon
              onAdd={async (name, _homeland, description, icon) => {
                const added = await addCategory.mutateAsync([name, description, icon]);
                setValue("category", String(added.id), changed);
              }}
            />
          </div>
          <div>
            <Controller
              control={control}
              name="craft_type"
              render={({ field }) => (
                <DescribedSelect
                  ref={field.ref}
                  label="Craft type"
                  placeholder={categoryId ? "Choose a craft type" : "Choose a category first"}
                  disabled={!categoryId}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  hint={chosenCraftType?.description || undefined}
                  error={errors.craft_type?.message}
                  options={craftTypeOptions.map((option) => ({
                    value: String(option.id),
                    label: option.name,
                    description: option.description,
                  }))}
                />
              )}
            />
            <AddItemInline
              noun="craft type"
              disabled={!categoryId}
              disabledHint="Choose a category to add a craft type to it."
              onAdd={async (name, _homeland, description) => {
                const added = await addCraftType.mutateAsync([
                  name,
                  categoryId as number,
                  description,
                ]);
                setValue("craft_type", String(added.id), changed);
              }}
            />
          </div>
        </div>
        <div>
          <Controller
            control={control}
            name="culture"
            render={({ field }) => (
              <DescribedSelect
                ref={field.ref}
                label="Culture"
                placeholder="Choose the culture it belongs to"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                hint={chosenCulture?.description || undefined}
                error={errors.culture?.message}
                options={cultureOptions.map((option) => ({
                  value: String(option.id),
                  label:
                    "homeland" in option && option.homeland
                      ? `${option.name} (${option.homeland})`
                      : option.name,
                  description: option.description,
                }))}
              />
            )}
          />
          <AddItemInline
            noun="culture"
            withHomeland
            onAdd={async (name, homeland, description) => {
              const added = await addCulture.mutateAsync([name, homeland, description]);
              setValue("culture", String(added.id), changed);
            }}
          />
        </div>
      </fieldset>

      <LocationPicker form={form} />

      <fieldset id="section-tools" className="form-section space-y-6">
        <legend>Tools and materials</legend>
        <ItemPicker
          label="Tools"
          noun="tool"
          items={tools.data}
          value={watch("tools")}
          onChange={(value) => setValue("tools", value, changed)}
          onCreate={(name, description) =>
            addTool.mutateAsync([name, craftTypeId ?? undefined, description])
          }
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
          onCreate={(name, description) =>
            addMaterial.mutateAsync([name, craftTypeId ?? undefined, description])
          }
          craftTypeName={craftTypeName}
          max={MAX_MATERIALS}
          error={errors.materials?.message}
        />
      </fieldset>

      <fieldset id="section-description" className="form-section space-y-4">
        <legend>Description and story</legend>
        <TextAreaField
          label="About this craft"
          hint={DESCRIPTION_HINT}
          rows={8}
          error={errors.description?.message}
          {...register("description")}
        />
        <TextAreaField
          label="Story (optional)"
          hint={STORY_HINT}
          rows={8}
          error={errors.story?.message}
          {...register("story")}
        />
      </fieldset>

      <fieldset id="section-characteristics" className="form-section space-y-6">
        <legend>Characteristics (optional)</legend>
        <p className="text-sm text-stone-600">Fill in only what applies to this craft.</p>
        <DateFields form={form} />
        <DimensionRows form={form} />
        <ColorRows form={form} />
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
