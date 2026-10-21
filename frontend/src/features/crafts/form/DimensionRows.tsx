import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";

import { DIMENSION_KINDS, DIMENSION_TYPES, unitsFor, type DimensionType } from "../attributes";

import { newDimension, type CraftFormValues } from "./schema";

const label = (type: string) => `${type[0].toUpperCase()}${type.slice(1)}`;

export function DimensionRows({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    control,
    register,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "attributes.dimensions" });
  const rowErrors = errors.attributes?.dimensions;
  const listError = rowErrors?.message ?? rowErrors?.root?.message;

  const addRow = () => {
    // Start with the first kind of dimension that is not entered yet.
    const used = new Set(getValues("attributes.dimensions").map((row) => row.type));
    const type = DIMENSION_TYPES.find((candidate) => !used.has(candidate)) ?? newDimension.type;
    append({ ...newDimension, type, unit: DIMENSION_KINDS[type].unit });
  };

  // A new measure of another kind, such as weight after height, needs one of its own units.
  const changeType = (index: number, type: DimensionType) => {
    if (!unitsFor(type).includes(getValues(`attributes.dimensions.${index}.unit`))) {
      setValue(`attributes.dimensions.${index}.unit`, DIMENSION_KINDS[type].unit);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-medium text-stone-800">Dimensions (optional)</p>
      {fields.map((field, index) => {
        const typeField = register(`attributes.dimensions.${index}.type`);
        return (
          <fieldset key={field.id} className="grid grid-cols-[1fr_1fr_6rem_auto] items-end gap-3">
            <legend className="sr-only">Dimension {index + 1}</legend>
            <SelectField
              label="Measure"
              error={rowErrors?.[index]?.type?.message}
              {...typeField}
              onChange={async (event) => {
                await typeField.onChange(event);
                changeType(index, event.target.value as DimensionType);
              }}
            >
              {DIMENSION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Amount"
              inputMode="decimal"
              error={rowErrors?.[index]?.value?.message}
              {...register(`attributes.dimensions.${index}.value`)}
            />
            <SelectField
              label="Unit"
              error={rowErrors?.[index]?.unit?.message}
              {...register(`attributes.dimensions.${index}.unit`)}
            >
              {unitsFor(watch(`attributes.dimensions.${index}.type`)).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </SelectField>
            <button
              type="button"
              className="mb-2 text-sm font-medium text-red-800 underline"
              onClick={() => remove(index)}
            >
              Remove <span className="sr-only">dimension {index + 1}</span>
            </button>
          </fieldset>
        );
      })}
      {fields.length < DIMENSION_TYPES.length && (
        <button type="button" className="btn-secondary px-3 py-1.5" onClick={addRow}>
          Add a dimension
        </button>
      )}
      {listError && <p className="text-sm text-red-700">{listError}</p>}
    </div>
  );
}
