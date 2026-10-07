import { lazy, Suspense, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { toApiError } from "@/api/envelope";
import { TextField } from "@/components/form/TextField";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "@/lib/toast";

import { geocodeApi } from "../api";
import type { Place } from "../types";

import type { CraftFormValues } from "./schema";

const LocationMap = lazy(() => import("../components/map/LocationMap"));

const changed = { shouldValidate: true, shouldDirty: true };

export function LocationPicker({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    register,
    setValue,
    getValues,
    setError,
    watch,
    formState: { errors },
  } = form;
  const [finding, setFinding] = useState(false);
  const [target, setTarget] = useState<[number, number] | null>(null);
  // Only the answer to the latest pin counts when the user moves it quickly.
  const latestLookup = useRef(0);

  const latitude = Number(watch("latitude"));
  const longitude = Number(watch("longitude"));
  const hasPosition =
    watch("latitude") !== "" &&
    watch("longitude") !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const setPosition = (lat: number, lng: number) => {
    setValue("latitude", lat.toFixed(6), changed);
    setValue("longitude", lng.toFixed(6), changed);
  };

  const setPlace = (place: Pick<Place, "city" | "country">) => {
    setValue("city", place.city, { shouldDirty: true });
    setValue("country", place.country, { shouldDirty: true });
  };

  const pinAddress = async () => {
    const address = getValues("address").trim();
    if (address.length < 3) {
      setError("address", { message: "Enter the address to pin." }, { shouldFocus: true });
      return;
    }
    latestLookup.current += 1;
    setFinding(true);
    try {
      const place = await geocodeApi.search(address);
      setPosition(place.latitude, place.longitude);
      setPlace(place);
      setTarget([place.latitude, place.longitude]);
      toast.success("The address is pinned on the map.");
    } catch (error) {
      const apiError = toApiError(error);
      toast.error(apiError.status === 404 ? "Address not found." : apiError.message);
    } finally {
      setFinding(false);
    }
  };

  /** The user placed the pin on the map: keep it there and fill in the address. */
  const pick = async (lat: number, lng: number) => {
    setPosition(lat, lng);
    const lookup = ++latestLookup.current;
    try {
      const place = await geocodeApi.reverse(lat, lng);
      if (lookup !== latestLookup.current) return;
      setValue("address", place.address, changed);
      setPlace(place);
    } catch (error) {
      if (lookup !== latestLookup.current) return;
      const apiError = toApiError(error);
      setPlace({ city: "", country: "" });
      toast.error(
        apiError.status === 404
          ? "No address found for this point. Type the address yourself."
          : apiError.message,
      );
    }
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-semibold">Location</legend>
      <p className="text-sm text-stone-600">
        Type the address where the craft comes from and pin it, or click the map to place the pin
        and the address is filled in for you.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <TextField
          label="Address"
          hint="As specific as you know it: a street, a village, or a town."
          autoComplete="off"
          className="min-w-0 flex-1"
          error={errors.address?.message}
          {...register("address")}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void pinAddress();
            }
          }}
        />
        <button
          type="button"
          disabled={finding}
          className="mt-6 rounded bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
          onClick={() => void pinAddress()}
        >
          {finding ? "Finding…" : "Pin address"}
        </button>
      </div>
      <Suspense fallback={<PageLoader label="Loading the map" />}>
        <LocationMap
          position={hasPosition ? [latitude, longitude] : null}
          target={target}
          onPick={(lat, lng) => void pick(lat, lng)}
        />
      </Suspense>
      <p className="text-sm text-stone-700" aria-live="polite">
        {hasPosition ? `Pinned at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.` : "No pin yet."}
      </p>
      {(errors.latitude || errors.longitude) && (
        <p role="alert" className="text-sm text-red-700">
          {errors.latitude?.message ?? errors.longitude?.message}
        </p>
      )}
    </fieldset>
  );
}
