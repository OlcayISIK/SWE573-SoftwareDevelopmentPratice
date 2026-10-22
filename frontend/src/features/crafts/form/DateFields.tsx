import type { UseFormReturn } from "react-hook-form";

import { SelectField } from "@/components/form/SelectField";
import { TextField } from "@/components/form/TextField";

import type { CraftFormValues } from "./schema";

const KINDS = [
  ["unknown", "Unknown"],
  ["year", "A year"],
  ["day", "An exact date"],
] as const;

const KIND_CHIP =
  "relative flex cursor-pointer items-center rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm font-medium transition-all hover:border-brand-300 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis";

/**
 * When the craft was made: unknown, a year before or after the common era, possibly approximate,
 * or an exact date.
 */
export function DateFields({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const kind = watch("date.kind");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold text-deep-sea">Date (optional)</legend>
      <p className="text-sm text-stone-600">
        When the craft, or the piece in the photos, was made.
      </p>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(([value, label]) => (
          <label key={value} className={KIND_CHIP}>
            <input
              type="radio"
              value={value}
              className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
              {...register("date.kind")}
            />
            {label}
          </label>
        ))}
      </div>
      {kind === "year" && (
        <div className="animate-fade-up grid items-start gap-3 sm:grid-cols-[10rem_16rem_auto]">
          <TextField
            label="Year"
            inputMode="numeric"
            error={errors.date?.year?.message}
            {...register("date.year")}
          />
          <SelectField label="Era" {...register("date.era")}>
            <option value="ad">AD (Milattan Sonra)</option>
            <option value="bc">BC (Milattan Önce)</option>
          </SelectField>
          <label className="flex items-center gap-2 pt-8 text-sm font-medium">
            <input type="checkbox" {...register("date.circa")} />
            Approximate (circa)
          </label>
        </div>
      )}
      {kind === "day" && (
        <TextField
          label="Date"
          type="date"
          max={today}
          className="animate-fade-up sm:w-64"
          error={errors.date?.day?.message}
          {...register("date.day")}
        />
      )}
    </fieldset>
  );
}
