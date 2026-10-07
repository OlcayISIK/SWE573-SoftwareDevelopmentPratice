import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { TextField } from "@/components/form/TextField";

import { parseColor, toStoredColor } from "../colors";
import { Swatch } from "../components/Swatch";

import { MAX_COLORS, type CraftFormValues } from "./schema";

const changed = { shouldValidate: true, shouldDirty: true };

export function ColorRows({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "colors" });
  const rows = watch("colors");

  return (
    <div className="space-y-3">
      <p className="font-medium text-stone-800">Colors (optional)</p>
      <p className="text-sm text-stone-600">
        Pick a color, or type its code: a hex code like #1e40af, rgb(30, 64, 175), hsl(225 71% 40%),
        or a CSS color name like turquoise.
      </p>
      {fields.map((field, index) => {
        const parsed = parseColor(rows[index]?.code ?? "");
        const setColor = (hex: string, alpha: number) =>
          setValue(`colors.${index}.code`, toStoredColor({ hex, alpha }), changed);

        return (
          <fieldset
            key={field.id}
            className="grid items-end gap-3 rounded border border-stone-200 bg-white p-3 sm:grid-cols-[auto_1fr_10rem_auto]"
          >
            <legend className="sr-only">Color {index + 1}</legend>
            <div className="flex items-end gap-2">
              <Swatch color={parsed ? toStoredColor(parsed) : "transparent"} />
              <label className="block text-sm font-medium text-stone-800">
                Picker
                <input
                  type="color"
                  className="mt-1 block h-9 w-12 cursor-pointer rounded border border-stone-300 bg-white"
                  value={parsed?.hex ?? "#000000"}
                  onChange={(event) => setColor(event.target.value, parsed?.alpha ?? 1)}
                />
              </label>
            </div>
            <TextField
              label="Color code"
              autoComplete="off"
              spellCheck={false}
              error={errors.colors?.[index]?.code?.message}
              {...register(`colors.${index}.code`)}
            />
            <label className="block text-sm font-medium text-stone-800">
              Opacity {parsed ? `${Math.round(parsed.alpha * 100)}%` : ""}
              <input
                type="range"
                min={0}
                max={100}
                className="mt-3 block w-full"
                disabled={!parsed}
                value={Math.round((parsed?.alpha ?? 1) * 100)}
                onChange={(event) =>
                  parsed && setColor(parsed.hex, Number(event.target.value) / 100)
                }
              />
            </label>
            <button
              type="button"
              className="mb-2 text-sm font-medium text-red-800 underline"
              onClick={() => remove(index)}
            >
              Remove <span className="sr-only">color {index + 1}</span>
            </button>
          </fieldset>
        );
      })}
      {fields.length < MAX_COLORS && (
        <button
          type="button"
          className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-100"
          onClick={() => append({ code: "" })}
        >
          Add a color
        </button>
      )}
      {(errors.colors?.message ?? errors.colors?.root?.message) && (
        <p className="text-sm text-red-700">
          {errors.colors?.message ?? errors.colors?.root?.message}
        </p>
      )}
    </div>
  );
}
