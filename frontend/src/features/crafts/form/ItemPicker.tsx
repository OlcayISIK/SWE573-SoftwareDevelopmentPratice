import { useId, useState } from "react";

import { toApiError } from "@/api/envelope";

import type { ChosenItem } from "./schema";

interface PickableItem {
  id: number;
  name: string;
  typical: boolean;
}

interface ItemPickerProps {
  /** The list name, for example "Tools". */
  label: string;
  /** One item, for example "tool". */
  noun: string;
  items: PickableItem[] | undefined;
  value: ChosenItem[];
  onChange: (value: ChosenItem[]) => void;
  /** Adds a name that is not in the list yet, and returns the new item. */
  onCreate: (name: string) => Promise<ChosenItem>;
  /** The chosen craft type, whose typical items are offered first. */
  craftTypeName?: string;
  max: number;
  error?: string;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Picks several items from a long list: the items typical for the craft type as checkboxes,
 * and any other item, or a new one, by typing its name.
 */
export function ItemPicker({
  label,
  noun,
  items = [],
  value,
  onChange,
  onCreate,
  craftTypeName,
  max,
  error,
}: ItemPickerProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const chosen = new Set(value.map((item) => item.id));
  const typical = craftTypeName ? items.filter((item) => item.typical) : [];
  const match = text.trim() ? items.find((item) => sameName(item.name, text)) : undefined;
  const full = value.length >= max;

  const add = (item: ChosenItem) => {
    if (!chosen.has(item.id) && !full) onChange([...value, item]);
  };
  const remove = (itemId: number) => onChange(value.filter((item) => item.id !== itemId));

  const addTyped = async () => {
    const name = text.trim();
    if (!name || full) return;
    setAddError(null);
    if (match) {
      add({ id: match.id, name: match.name });
      setText("");
      return;
    }
    setPending(true);
    try {
      add(await onCreate(name));
      setText("");
    } catch (failure) {
      const apiError = toApiError(failure);
      setAddError(apiError.fieldErrors.name?.join(" ") ?? apiError.message);
    } finally {
      setPending(false);
    }
  };

  const buttonLabel = match
    ? chosen.has(match.id)
      ? `${match.name} is chosen`
      : `Add ${match.name}`
    : `Add “${text.trim()}” as a new ${noun}`;

  return (
    <fieldset className="space-y-3" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="font-medium text-stone-800">{label} (optional)</legend>

      {value.length > 0 && (
        <ul aria-label={`Chosen ${label.toLowerCase()}`} className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-1 text-sm"
            >
              {item.name}
              <button
                type="button"
                className="rounded-full px-2 hover:bg-brand-200"
                aria-label={`Remove ${item.name}`}
                onClick={() => remove(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {typical.length > 0 && (
        <div>
          <p className="text-sm text-stone-700">Typical for {craftTypeName}:</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {typical.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chosen.has(item.id)}
                  disabled={full && !chosen.has(item.id)}
                  onChange={(event) =>
                    event.target.checked ? add({ id: item.id, name: item.name }) : remove(item.id)
                  }
                />
                {item.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor={`${id}-other`} className="block text-sm font-medium text-stone-800">
          {typical.length ? `Other ${label.toLowerCase()}` : `Find a ${noun}`}
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id={`${id}-other`}
            list={`${id}-names`}
            value={text}
            maxLength={80}
            disabled={full}
            aria-describedby={addError ? `${id}-add-error` : undefined}
            className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addTyped();
              }
            }}
          />
          <datalist id={`${id}-names`}>
            {items.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          {text.trim() && (
            <button
              type="button"
              disabled={pending || full || (match !== undefined && chosen.has(match.id))}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-brand-100 disabled:opacity-60"
              onClick={() => void addTyped()}
            >
              {pending ? "Adding…" : buttonLabel}
            </button>
          )}
        </div>
        {full && (
          <p className="mt-1 text-sm text-stone-600">
            You can choose up to {max} {label.toLowerCase()}.
          </p>
        )}
        {addError && (
          <p id={`${id}-add-error`} className="mt-1 text-sm text-red-700">
            {addError}
          </p>
        )}
      </div>

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
