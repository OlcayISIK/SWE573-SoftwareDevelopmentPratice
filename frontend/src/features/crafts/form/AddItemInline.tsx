import { useEffect, useRef, useState } from "react";

import { toApiError } from "@/api/envelope";
import { TextField } from "@/components/form/TextField";

import { CATEGORY_ICONS, type CategoryIcon, DEFAULT_CATEGORY_ICON } from "../categoryStyle";

interface AddItemInlineProps {
  /** What is added, for example "craft type". */
  noun: string;
  /** Cultures also take the homeland of the people. */
  withHomeland?: boolean;
  /** Categories also take an icon, picked from a fixed set. */
  withIcon?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onAdd: (name: string, homeland: string, description: string, icon: CategoryIcon) => Promise<void>;
}

/**
 * A small form for adding a missing item to a list. It is not a <form>, because it sits inside
 * the craft form, so Enter is handled here instead of submitting the craft.
 */
export function AddItemInline({
  noun,
  withHomeland = false,
  withIcon = false,
  disabled = false,
  disabledHint,
  onAdd,
}: AddItemInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [homeland, setHomeland] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<CategoryIcon>(DEFAULT_CATEGORY_ICON);
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
    setDescription("");
    setIcon(DEFAULT_CATEGORY_ICON);
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
      await onAdd(name.trim(), homeland.trim(), description.trim(), icon);
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
      <TextField
        label="Description (optional)"
        hint={`A sentence on what the ${noun} is. People see it when they point at the ${noun}.`}
        value={description}
        maxLength={300}
        onChange={(event) => setDescription(event.target.value)}
        onKeyDown={submitOnEnter}
      />
      {withIcon && (
        <fieldset>
          <legend className="text-sm font-semibold text-deep-sea">Icon</legend>
          <p className="text-sm text-stone-600">Shown on the map and next to the {noun}.</p>
          <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {CATEGORY_ICONS.map(({ key, icon: Icon, label }) => (
              <label
                key={key}
                title={label}
                className="relative flex aspect-square cursor-pointer items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-700 transition-all hover:border-brand-300 hover:text-brand-700 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-700 has-[:checked]:text-white has-[:checked]:shadow-md has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis"
              >
                <input
                  type="radio"
                  name={`${noun}-icon`}
                  value={key}
                  aria-label={label}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                  className="absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
                />
                <Icon aria-hidden="true" className="h-5 w-5" />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-sm text-stone-600">Everyone can pick it once it is added.</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending}
          className="btn-primary px-3 py-1.5"
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
