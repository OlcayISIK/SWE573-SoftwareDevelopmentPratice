import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { TextField } from "@/components/form/TextField";

import type { Material } from "../types";

import { ItemPicker } from "./ItemPicker";
import {
  emptyPart,
  MAX_MATERIALS,
  MAX_PARTS,
  type ChosenItem,
  type CraftFormValues,
} from "./schema";

const changed = { shouldValidate: true, shouldDirty: true };

/**
 * Parts of the craft made of their own materials, such as a metal blade and a wooden handle.
 * Each part has a name and the materials it is made of.
 */
export function PartRows({
  form,
  materials,
  onCreateMaterial,
  craftTypeName,
}: {
  form: UseFormReturn<CraftFormValues>;
  materials: Material[] | undefined;
  onCreateMaterial: (name: string, description?: string) => Promise<ChosenItem>;
  craftTypeName?: string;
}) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "parts" });
  const rows = watch("parts");
  const error = errors.parts?.message ?? errors.parts?.root?.message;

  return (
    <div className="space-y-3">
      <p className="font-semibold text-deep-sea">Parts (optional)</p>
      <p className="text-sm text-stone-600">
        When parts of the craft are made of different materials, such as a metal blade and a wooden
        handle, add each part with its materials. The materials above are for the whole craft.
      </p>
      {fields.map((field, index) => {
        const name = rows[index]?.name.trim();
        return (
          <fieldset
            key={field.id}
            className="animate-fade-in space-y-4 rounded-sm border border-stone-200 bg-white p-4"
          >
            <legend className="sr-only">{name || `Part ${index + 1}`}</legend>
            <div className="flex flex-wrap items-end gap-3">
              <TextField
                label="Part name"
                className="min-w-0 flex-1"
                placeholder="For example, Blade"
                maxLength={80}
                autoComplete="off"
                error={errors.parts?.[index]?.name?.message}
                {...register(`parts.${index}.name`)}
              />
              <button
                type="button"
                className="mb-2.5 text-sm font-medium text-red-800 underline"
                onClick={() => remove(index)}
              >
                Remove <span className="sr-only">{name || `part ${index + 1}`}</span>
              </button>
            </div>
            <ItemPicker
              label={name ? `Materials of ${name}` : "Materials of this part"}
              noun="material"
              optional={false}
              items={materials}
              value={rows[index]?.materials ?? []}
              onChange={(value) => setValue(`parts.${index}.materials`, value, changed)}
              onCreate={onCreateMaterial}
              craftTypeName={craftTypeName}
              max={MAX_MATERIALS}
              error={errors.parts?.[index]?.materials?.message}
            />
          </fieldset>
        );
      })}
      {fields.length < MAX_PARTS && (
        <button
          type="button"
          className="btn-secondary px-3 py-1.5"
          onClick={() => append(emptyPart)}
        >
          Add a part
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
