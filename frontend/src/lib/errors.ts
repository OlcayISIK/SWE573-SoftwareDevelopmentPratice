import { toApiError } from "@/api/envelope";

import { toast } from "./toast";

/**
 * Shows a toast for errors the user cannot fix in a form: network failures, rate limits, and
 * server errors. Validation and permission errors are handled where they happen.
 */
export function notifyGlobalError(error: unknown, retry?: () => void) {
  const apiError = toApiError(error);
  const action = retry ? { label: "Retry", onClick: retry } : undefined;

  if (apiError.isNetworkError) {
    toast.error("Could not reach the server. Check your connection and try again.", action);
  } else if (apiError.status === 429) {
    toast.error("Too many requests. Please wait a moment and try again.");
  } else if (apiError.status >= 500) {
    toast.error("Something went wrong on our side. Please try again.", action);
  }
}
