import { lazy, Suspense, useRef, useState } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";

import { toApiError } from "@/api/envelope";
import { TextField } from "@/components/form/TextField";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "@/lib/toast";

import { geocodeApi } from "../api";
import type { Place } from "../types";

import { emptyPlace, MAX_PLACES, type CraftFormValues } from "./schema";

const LocationMap = lazy(() => import("../components/map/LocationMap"));

const changed = { shouldValidate: true, shouldDirty: true };

interface PlaceFieldsProps {
  form: UseFormReturn<CraftFormValues>;
  index: number;
  /** Shown when the craft has more than one place. */
  onRemove?: () => void;
}

/** One place: its address with a "Pin address" button, and a map to place the pin on. */
function PlaceFields({ form, index, onRemove }: PlaceFieldsProps) {
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
  const path = `places.${index}` as const;
  const placeErrors = errors.places?.[index];

  const rawLatitude = watch(`${path}.latitude`);
  const rawLongitude = watch(`${path}.longitude`);
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const hasPosition =
    rawLatitude !== "" &&
    rawLongitude !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const setPosition = (lat: number, lng: number) => {
    setValue(`${path}.latitude`, lat.toFixed(6), changed);
    setValue(`${path}.longitude`, lng.toFixed(6), changed);
  };

  const setPlace = (place: Pick<Place, "city" | "country">) => {
    setValue(`${path}.city`, place.city, { shouldDirty: true });
    setValue(`${path}.country`, place.country, { shouldDirty: true });
  };

  const pinAddress = async () => {
    const address = getValues(`${path}.address`).trim();
    if (address.length < 3) {
      setError(`${path}.address`, { message: "Enter the address to pin." }, { shouldFocus: true });
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
      setValue(`${path}.address`, place.address, changed);
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

  const coordinateError = placeErrors?.latitude?.message ?? placeErrors?.longitude?.message;
  return (
    <fieldset className="space-y-3 rounded border border-stone-200 p-4">
      <legend className="px-1 font-medium">Place {index + 1}</legend>
      <div className="flex flex-wrap items-start gap-3">
        <TextField
          label="Address"
          hint="As specific as you know it: a street, a village, or a town."
          autoComplete="off"
          className="min-w-0 flex-1"
          error={placeErrors?.address?.message}
          {...register(`${path}.address`)}
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
      {coordinateError && (
        <p role="alert" className="text-sm text-red-700">
          {coordinateError}
        </p>
      )}
      {onRemove && (
        <button
          type="button"
          className="text-sm font-medium text-red-800 underline"
          onClick={onRemove}
        >
          Remove place {index + 1}
        </button>
      )}
    </fieldset>
  );
}

/**
 * Where the craft is made or belongs: one or more places. With several, the author can name one
 * as the origin, or leave all of them equal.
 */
export function LocationPicker({ form }: { form: UseFormReturn<CraftFormValues> }) {
  const {
    control,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "places" });
  const places = watch("places");
  // Controlled, so the choice follows its place when an earlier place is removed.
  const origin = watch("origin");
  const listError = errors.places?.message ?? errors.places?.root?.message;

  const removePlace = (index: number) => {
    // Keep the origin on the same place, or make all places equal if it is removed.
    const origin = getValues("origin");
    if (origin !== "") {
      const originIndex = Number(origin);
      if (originIndex === index) setValue("origin", "");
      else if (originIndex > index) setValue("origin", String(originIndex - 1));
    }
    remove(index);
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">Places</legend>
      <p className="text-sm text-stone-600">
        Type the address where the craft comes from and pin it, or click the map to place the pin
        and the address is filled in for you. A craft made in several places can list each of them.
      </p>
      {fields.map((field, index) => (
        <PlaceFields
          key={field.id}
          form={form}
          index={index}
          onRemove={fields.length > 1 ? () => removePlace(index) : undefined}
        />
      ))}
      {fields.length < MAX_PLACES && (
        <button
          type="button"
          className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-100"
          onClick={() => append({ ...emptyPlace })}
        >
          Add another place
        </button>
      )}
      {listError && <p className="text-sm text-red-700">{listError}</p>}

      {fields.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="font-medium text-stone-800">Origin</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="origin"
              checked={origin === ""}
              onChange={() => setValue("origin", "", { shouldDirty: true })}
            />
            All places are equal
          </label>
          {places.map((place, index) => (
            <label key={fields[index]?.id ?? index} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="origin"
                checked={origin === String(index)}
                onChange={() => setValue("origin", String(index), { shouldDirty: true })}
              />
              Place {index + 1} is the origin
              {place.address.trim() && (
                <span className="text-stone-600">({place.address.trim()})</span>
              )}
            </label>
          ))}
        </fieldset>
      )}
    </fieldset>
  );
}
