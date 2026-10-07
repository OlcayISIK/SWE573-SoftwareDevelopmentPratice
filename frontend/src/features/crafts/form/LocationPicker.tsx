import { lazy, Suspense } from "react";
import type { UseFormReturn } from "react-hook-form";

import { TextField } from "@/components/form/TextField";
import { PageLoader } from "@/components/PageLoader";

import type { CraftFormValues } from "./schema";

const LocationMap = lazy(() => import("../components/map/LocationMap"));

export function LocationPicker({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const latitude = Number(watch("latitude"));
  const longitude = Number(watch("longitude"));
  const hasPosition =
    watch("latitude") !== "" &&
    watch("longitude") !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const pick = (lat: number, lng: number) => {
    const options = { shouldValidate: true, shouldDirty: true };
    setValue("latitude", lat.toFixed(6), options);
    setValue("longitude", lng.toFixed(6), options);
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold">Location</legend>
      <p className="text-sm text-stone-600">
        Click the map or drag the pin to where the craft comes from, or type the coordinates.
      </p>
      <Suspense fallback={<PageLoader label="Loading the map" />}>
        <LocationMap position={hasPosition ? [latitude, longitude] : null} onPick={pick} />
      </Suspense>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Latitude"
          inputMode="decimal"
          error={errors.latitude?.message}
          {...register("latitude")}
        />
        <TextField
          label="Longitude"
          inputMode="decimal"
          error={errors.longitude?.message}
          {...register("longitude")}
        />
      </div>
    </fieldset>
  );
}
