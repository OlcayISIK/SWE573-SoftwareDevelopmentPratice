import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { toApiError } from "@/api/envelope";

/** The rendered field a server error key belongs to: an exact match, or the closest parent. */
function matchField(key: string, fields: readonly string[]) {
  return fields
    .filter((field) => key === field || key.startsWith(`${field}.`))
    .sort((a, b) => b.length - a.length)[0];
}

/**
 * Puts server field errors next to the matching inputs. Returns the message to show at the top of
 * the form when the error is not tied to a field we render.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const apiError = toApiError(error);
  if (apiError.isNetworkError || apiError.status === 429 || apiError.status >= 500) {
    return null;
  }

  let matched = false;
  for (const [key, messages] of Object.entries(apiError.fieldErrors)) {
    const field = matchField(key, fields);
    if (field) {
      setError(field as Path<T>, { type: "server", message: messages.join(" ") });
      matched = true;
    }
  }
  return matched ? null : apiError.message;
}
