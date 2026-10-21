import { useEffect, useId, useRef, useState } from "react";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { useAuth } from "@/features/auth/context";
import { SignInPrompt } from "@/features/social/components/SignInPrompt";

import {
  ITEM_KIND_LABELS,
  ITEM_REASON_LABELS,
  itemModerationApi,
  moderationApi,
  REASON_LABELS,
  type ItemKind,
  type ItemReportReason,
  type ReportReason,
} from "../api";

interface Reason<T extends string> {
  value: T;
  label: string;
  hint: string;
}

const CRAFT_REASONS: Reason<ReportReason>[] = [
  {
    value: "inaccurate",
    label: REASON_LABELS.inaccurate,
    hint: "Facts, origin, or how it is made are wrong.",
  },
  {
    value: "inappropriate",
    label: REASON_LABELS.inappropriate,
    hint: "The content does not belong on this site.",
  },
  {
    value: "disrespectful",
    label: REASON_LABELS.disrespectful,
    hint: "It misrepresents or stereotypes a culture or community.",
  },
];

const ITEM_REASONS: Reason<ItemReportReason>[] = [
  {
    value: "duplicate",
    label: ITEM_REASON_LABELS.duplicate,
    hint: "The same item is already listed under another name.",
  },
  {
    value: "inaccurate",
    label: ITEM_REASON_LABELS.inaccurate,
    hint: "The name is misspelled or wrong.",
  },
  {
    value: "inappropriate",
    label: ITEM_REASON_LABELS.inappropriate,
    hint: "It does not belong in this list.",
  },
];

interface ReportDialogProps<T extends string> {
  title: string;
  reasons: Reason<T>[];
  doneMessage: string;
  onSend: (reason: T, note: string) => Promise<unknown>;
  onClose: () => void;
}

function ReportDialog<T extends string>({
  title,
  reasons,
  doneMessage,
  onSend,
  onClose,
}: ReportDialogProps<T>) {
  const titleId = useId();
  const firstRadio = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<T | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {done ? (
          <>
            <p role="status" className="mt-3 text-stone-700">
              Thank you. {doneMessage}
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
            onSubmit={async (event) => {
              event.preventDefault();
              if (!reason) {
                setError("Choose a reason.");
                return;
              }
              setPending(true);
              setError(null);
              try {
                await onSend(reason, note.trim());
                setDone(true);
              } catch (failure) {
                setError(toApiError(failure).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <FormAlert>{error}</FormAlert>
            <fieldset className="space-y-2">
              <legend className="font-medium">Why are you reporting it?</legend>
              {reasons.map((option, index) => (
                <label key={option.value} className="flex items-start gap-3">
                  <input
                    ref={index === 0 ? firstRadio : undefined}
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={reason === option.value}
                    className="mt-1"
                    onChange={() => setReason(option.value)}
                  />
                  <span>
                    {option.label}
                    <span className="block text-sm text-stone-600">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <TextAreaField
              label="Details (optional)"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <SubmitButton pending={pending} pendingLabel="Sending…">
                Send report
              </SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ReportButton({ craftId, authorId }: { craftId: number; authorId: number }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);

  if (auth.status === "guest") {
    return <SignInPrompt label="Log in to report" />;
  }
  if (auth.status !== "authenticated" || auth.user.id === authorId) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        className="btn border border-stone-300 bg-white text-stone-800 hover:border-red-300 hover:text-red-800"
        onClick={() => setOpen(true)}
      >
        Report
      </button>
      {open && (
        <ReportDialog
          title="Report this craft"
          reasons={CRAFT_REASONS}
          doneMessage="An admin will review this craft."
          onSend={(reason, note) => moderationApi.report(craftId, { reason, note })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Reports an item that a user added to one of the lists, such as a tool. Seeded items cannot be
 * reported, so the button only shows for items added by users, and only to signed-in users.
 */
export function ReportItemButton({
  kind,
  item,
}: {
  kind: ItemKind;
  item: { id: number; name: string; user_added: boolean };
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);

  if (!item.user_added || auth.status !== "authenticated") {
    return null;
  }
  const kindLabel = ITEM_KIND_LABELS[kind].toLowerCase();
  return (
    <>
      <button
        type="button"
        className="ml-1 text-xs text-stone-600 underline hover:text-red-800"
        onClick={() => setOpen(true)}
      >
        Report <span className="sr-only">{`${kindLabel} ${item.name}`}</span>
      </button>
      {open && (
        <ReportDialog
          title={`Report the ${kindLabel} “${item.name}”`}
          reasons={ITEM_REASONS}
          doneMessage="An admin will review it."
          onSend={(reason, note) => itemModerationApi.report(kind, item.id, { reason, note })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
