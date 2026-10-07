import { useEffect, useRef, useState } from "react";

import { toApiError } from "@/api/envelope";
import { TextField } from "@/components/form/TextField";

interface AddItemInlineProps {
  /** What is added, for example "craft type". */
  noun: string;
  /** Cultures also take the homeland of the people. */
  withHomeland?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onAdd: (name: string, homeland: string) => Promise<void>;
}

/**
 * A small form for adding a missing item to a list. It is not a <form>, because it sits inside
 * the craft form, so Enter is handled here instead of submitting the craft.
 */
export function AddItemInline({
  noun,
  withHomeland = false,
  disabled = false,
  disabledHint,
  onAdd,
}: AddItemInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [homeland, setHomeland] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  // The user asked to add an item, so take them to its name.
  useEffect(() => {
    if (open) nameInput.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="mt-1">
        <button
          type="button"
          disabled={disabled}
          className="text-sm font-medium text-brand-700 underline disabled:text-stone-500 disabled:no-underline"
          onClick={() => setOpen(true)}
        >
          Add a new {noun}
        </button>
        {disabled && disabledHint && <p className="text-sm text-stone-600">{disabledHint}</p>}
      </div>
    );
  }

  const close = () => {
    setOpen(false);
    setName("");
    setHomeland("");
    setError(null);
  };

  const submit = async () => {
    if (name.trim().length < 2) {
      setError(`Enter the name of the ${noun}.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onAdd(name.trim(), homeland.trim());
      close();
    } catch (failure) {
      const apiError = toApiError(failure);
      setError(apiError.fieldErrors.name?.join(" ") ?? apiError.message);
    } finally {
      setPending(false);
    }
  };

  const submitOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div
      role="group"
      aria-label={`Adding a ${noun}`}
      className="mt-2 space-y-3 rounded bg-brand-50 p-3"
    >
      <TextField
        label={`New ${noun}`}
        ref={nameInput}
        value={name}
        maxLength={80}
        error={error ?? undefined}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={submitOnEnter}
      />
      {withHomeland && (
        <TextField
          label="Homeland (optional)"
          hint="Where the people live, for example: Southwestern United States."
          value={homeland}
          maxLength={120}
          onChange={(event) => setHomeland(event.target.value)}
          onKeyDown={submitOnEnter}
        />
      )}
      <p className="text-sm text-stone-600">Everyone can pick it once it is added.</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          className="rounded bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
          onClick={() => void submit()}
        >
          {pending ? "Adding…" : `Add ${noun}`}
        </button>
        <button type="button" className="text-sm underline" onClick={close}>
          Cancel
        </button>
      </div>
    </div>
  );
}
