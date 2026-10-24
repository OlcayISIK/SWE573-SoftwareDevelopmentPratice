import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";

import { emptyCraftForm, type CraftFormValues } from "./schema";
import { clearDraft, useDraft } from "./useDraft";

const DRAFT_KEY = "ic.craft-draft.v3";

function renderDraftForm() {
  return renderHook(() => {
    const form = useForm<CraftFormValues>({ defaultValues: emptyCraftForm });
    useDraft(form);
    return form;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

test("the draft is saved once the author pauses typing", () => {
  const { result } = renderDraftForm();

  act(() => result.current.setValue("name", "Kilim"));
  expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  act(() => vi.advanceTimersByTime(400));

  expect(JSON.parse(localStorage.getItem(DRAFT_KEY)!).name).toBe("Kilim");
});

test("clearing the draft right after typing cancels the waiting save", () => {
  const { result } = renderDraftForm();

  act(() => result.current.setValue("name", "Kilim"));
  clearDraft();
  act(() => vi.advanceTimersByTime(1000));

  expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
});
