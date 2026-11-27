import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import {
  PRACTICE_STATUS_HINTS,
  PRACTICE_STATUS_LABELS,
  PRACTICE_STATUSES,
  type PracticeStatus,
} from "@/features/crafts/practiceStatus";
import { toast } from "@/lib/toast";

import { useProposePracticeStatus, useSetPracticeStatus } from "../queries";

const MAX_SOURCE = 500;
const MAX_TEXT = 1000;

type FieldName = "practice_status" | "source" | "note" | "reason";
type Errors = Partial<Record<FieldName, string>>;

interface PracticeStatusDialogProps {
  craft: { id: number; name: string; practice_status: string; practice_status_source: string };
  /** Users report a status they think is wrong, for admins to review; admins set it directly. */
  mode: "report" | "set";
  onClose: () => void;
}

const SOURCE_OR_NOTE = "Give a source, or a note that says why the status is wrong.";

/**
 * Reports or sets whether a craft is still practiced. A report says what the status should be,
 * with a source or a note; an admin sets it with a source, except back to unknown, and a reason.
 */
export function PracticeStatusDialog({ craft, mode, onClose }: PracticeStatusDialogProps) {
  const titleId = useId();
  const firstRadio = useRef<HTMLInputElement>(null);
  const propose = useProposePracticeStatus(craft.id);
  const set = useSetPracticeStatus(craft.id);
  const setting = mode === "set";
  const [status, setStatus] = useState<PracticeStatus | null>(
    setting ? (craft.practice_status as PracticeStatus) : null,
  );
  const [source, setSource] = useState(setting ? craft.practice_status_source : "");
  // A note for a report, the reason for an admin's change.
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstRadio.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  const validate = (): Errors => {
    const found: Errors = {};
    if (!status) found.practice_status = "Choose a status.";
    if (setting) {
      if (!source.trim() && status !== "unknown") {
        found.source = "Give the source the practice status is based on.";
      }
      if (!text.trim()) found.reason = "Explain the reason for this change.";
    } else if (!source.trim() && !text.trim()) {
      found.source = SOURCE_OR_NOTE;
    }
    return found;
  };

  const showServerError = (failure: unknown) => {
    const error = toApiError(failure);
    const fields = error.fieldErrors;
    const onFields: Errors = {};
    for (const name of ["practice_status", "source", "note", "reason"] as FieldName[]) {
      if (fields[name]?.length) onFields[name] = fields[name].join(" ");
    }
    setErrors(onFields);
    setAlert(Object.keys(onFields).length ? null : error.message);
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    setAlert(null);
    if (Object.keys(found).length) return;
    if (setting) {
      set.mutate(
        { practice_status: status!, source: source.trim(), reason: text.trim() },
        {
          onSuccess: () => {
            toast.success("The practice status was updated.");
            onClose();
          },
          onError: showServerError,
        },
      );
    } else {
      propose.mutate(
        { practice_status: status!, source: source.trim(), note: text.trim() },
        { onSuccess: () => setDone(true), onError: showServerError },
      );
    }
  };

  const known = craft.practice_status !== "unknown";
  // A report says what the status should be; "unknown" means not sure, but this is wrong.
  const choices = setting
    ? PRACTICE_STATUSES
    : PRACTICE_STATUSES.filter((value) => value !== craft.practice_status);
  const label = (value: PracticeStatus) =>
    !setting && value === "unknown" ? "Not sure, but this is wrong" : PRACTICE_STATUS_LABELS[value];
  const hint = (value: PracticeStatus) =>
    !setting && value === "unknown" ? "Use the note to say why." : PRACTICE_STATUS_HINTS[value];
  const title = setting
    ? "Set the practice status"
    : known
      ? "Report the practice status"
      : "Suggest a practice status";

  return createPortal(
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {setting || !known
            ? `Is “${craft.name}” still practiced?`
            : `“${craft.name}” is marked as ${PRACTICE_STATUS_LABELS[
                craft.practice_status as PracticeStatus
              ].toLowerCase()}. What should it be?`}
        </p>
        {done ? (
          <>
            <p role="status" className="mt-3 text-stone-700">
              Thank you. An admin will review your report. You will get a notification when it is
              reviewed.
            </p>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form
            noValidate
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submit();
            }}
          >
            <FormAlert>{alert}</FormAlert>
            <fieldset
              className="space-y-2"
              aria-describedby={errors.practice_status ? `${titleId}-status-error` : undefined}
            >
              <legend className="font-medium">{setting ? "Status" : "What should it be?"}</legend>
              {choices.map((value, index) => (
                <label key={value} className="flex items-start gap-3">
                  <input
                    ref={index === 0 ? firstRadio : undefined}
                    type="radio"
                    name="practice_status"
                    value={value}
                    checked={status === value}
                    className="mt-1"
                    onChange={() => setStatus(value)}
                  />
                  <span>
                    {label(value)}
                    <span className="block text-sm text-stone-600">{hint(value)}</span>
                  </span>
                </label>
              ))}
              {errors.practice_status && (
                <p id={`${titleId}-status-error`} className="text-sm text-red-700">
                  {errors.practice_status}
                </p>
              )}
            </fieldset>
            <TextAreaField
              label={setting ? (status === "unknown" ? "Source (optional)" : "Source") : "Source"}
              hint={
                setting
                  ? "A citation or a link, such as the UNESCO List of Intangible Cultural Heritage in Need of Urgent Safeguarding."
                  : "A citation or a link that shows the right status. Give a source, a note, or both."
              }
              rows={2}
              maxLength={MAX_SOURCE}
              value={source}
              error={errors.source}
              onChange={(event) => setSource(event.target.value)}
            />
            <TextAreaField
              label={setting ? "Reason" : "Note"}
              hint={setting ? "Recorded with the change." : undefined}
              rows={3}
              maxLength={MAX_TEXT}
              value={text}
              error={setting ? errors.reason : errors.note}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <SubmitButton
                pending={setting ? set.isPending : propose.isPending}
                pendingLabel="Sending…"
              >
                {setting ? "Save status" : "Send report"}
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
