import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CraftFormValues } from "./schema";

const DRAFT_KEY = "ic.craft-draft";

export function loadDraft(): CraftFormValues | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CraftFormValues) : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable; nothing was saved.
  }
}

/** Saves the form to localStorage as the author types, so a reload does not lose their work. */
export function useDraft(form: UseFormReturn<CraftFormValues>) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        } catch {
          // Storage full or unavailable; the draft is just not kept.
        }
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [form]);
}
