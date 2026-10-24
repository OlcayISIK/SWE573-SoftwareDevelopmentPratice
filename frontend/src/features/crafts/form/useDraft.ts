import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import { emptyCraftForm, type CraftFormValues } from "./schema";

// The key changes when the form is reshaped, so a draft from an older form is not restored.
// Newly added fields do not need a new key; see loadDraft.
const DRAFT_KEY = "ic.craft-draft.v3";
const OLD_DRAFT_KEYS = ["ic.craft-draft", "ic.craft-draft.v2"];

// A save waits for the author to pause typing. Clearing the draft cancels it, or a craft
// published right after typing would come back as a draft.
let pendingSave: ReturnType<typeof setTimeout> | undefined;

export function loadDraft(): CraftFormValues | null {
  try {
    OLD_DRAFT_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(DRAFT_KEY);
    // Fields added to the form since the draft was saved start empty.
    return raw ? { ...emptyCraftForm, ...(JSON.parse(raw) as Partial<CraftFormValues>) } : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  clearTimeout(pendingSave);
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable; nothing was saved.
  }
}

/** Saves the form to localStorage as the author types, so a reload does not lose their work. */
export function useDraft(form: UseFormReturn<CraftFormValues>) {
  useEffect(() => {
    const subscription = form.watch((values) => {
      clearTimeout(pendingSave);
      pendingSave = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
        } catch {
          // Storage full or unavailable; the draft is just not kept.
        }
      }, 400);
    });
    return () => {
      clearTimeout(pendingSave);
      subscription.unsubscribe();
    };
  }, [form]);
}
