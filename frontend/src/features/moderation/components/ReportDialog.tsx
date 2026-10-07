import { useEffect, useId, useRef, useState } from "react";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { useAuth } from "@/features/auth/context";
import { SignInPrompt } from "@/features/social/components/SignInPrompt";

import { moderationApi, REASON_LABELS, type ReportReason } from "../api";

const REASON_HINTS: Record<ReportReason, string> = {
  inaccurate: "Facts, origin, or how it is made are wrong.",
  inappropriate: "The content does not belong on this site.",
  disrespectful: "It misrepresents or stereotypes a culture or community.",
};

function Dialog({ craftId, onClose }: { craftId: number; onClose: () => void }) {
  const titleId = useId();
  const firstRadio = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
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
          Report this craft
        </h2>
        {done ? (
          <>
            <p role="status" className="mt-3 text-stone-700">
              Thank you. An admin will review this craft.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded bg-brand-700 px-4 py-2 font-medium text-white"
                onClick={onClose}
              >
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
                await moderationApi.report(craftId, { reason, note: note.trim() });
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
              {(Object.keys(REASON_LABELS) as ReportReason[]).map((value, index) => (
                <label key={value} className="flex items-start gap-3">
                  <input
                    ref={index === 0 ? firstRadio : undefined}
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    className="mt-1"
                    onChange={() => setReason(value)}
                  />
                  <span>
                    {REASON_LABELS[value]}
                    <span className="block text-sm text-stone-600">{REASON_HINTS[value]}</span>
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
              <button
                type="button"
                className="rounded border border-stone-300 px-4 py-2 font-medium"
                onClick={onClose}
              >
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
        className="rounded border border-stone-300 bg-white px-4 py-2 font-medium hover:bg-brand-100"
        onClick={() => setOpen(true)}
      >
        Report
      </button>
      {open && <Dialog craftId={craftId} onClose={() => setOpen(false)} />}
    </>
  );
}
