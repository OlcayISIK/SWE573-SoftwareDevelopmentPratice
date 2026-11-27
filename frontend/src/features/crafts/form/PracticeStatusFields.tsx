import type { UseFormReturn } from "react-hook-form";

import { TextAreaField } from "@/components/form/TextAreaField";

import {
  PRACTICE_STATUS_HINTS,
  PRACTICE_STATUS_LABELS,
  PRACTICE_STATUSES,
} from "../practiceStatus";

import type { CraftFormValues } from "./schema";

/**
 * Whether the craft is still practiced. The author chooses it; other users can report it if
 * they think it is wrong, so a source helps it stand.
 */
export function PracticeStatusFields({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const status = watch("practice_status");

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-deep-sea">Is it still practiced?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRACTICE_STATUSES.map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-2.5 rounded-sm bg-white p-2.5 ring-1 ring-stone-200 has-[:checked]:ring-2 has-[:checked]:ring-brand-700"
          >
            <input type="radio" value={value} className="mt-1" {...register("practice_status")} />
            <span>
              <span className="font-medium">{PRACTICE_STATUS_LABELS[value]}</span>
              <span className="block text-sm text-stone-600">{PRACTICE_STATUS_HINTS[value]}</span>
            </span>
          </label>
        ))}
      </div>
      {status !== "unknown" && (
        <TextAreaField
          label="Source (optional)"
          hint="What says so, such as a citation or a link. Other users can report the status if they think it is wrong, and a source helps it stand."
          rows={2}
          maxLength={500}
          error={errors.practice_status_source?.message}
          {...register("practice_status_source")}
        />
      )}
    </fieldset>
  );
}
