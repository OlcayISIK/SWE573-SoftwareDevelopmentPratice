/* eslint-disable jsx-a11y/click-events-have-key-events -- options get their keys from the
   focused input or list, through aria-activedescendant, as the ARIA combobox pattern asks. */
import { Check } from "lucide-react";
import { useId, useState } from "react";

import { toApiError } from "@/api/envelope";
import { Tooltip } from "@/components/Tooltip";

import { AddItemInline } from "./AddItemInline";
import type { ChosenItem } from "./schema";

interface PickableItem {
  id: number;
  name: string;
  description: string;
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
  onCreate: (name: string, description?: string) => Promise<ChosenItem>;
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
  const [suggesting, setSuggesting] = useState(false);
  const [active, setActive] = useState(-1);

  const chosen = new Set(value.map((item) => item.id));
  const typical = craftTypeName ? items.filter((item) => item.typical) : [];
  const match = text.trim() ? items.find((item) => sameName(item.name, text)) : undefined;
  const full = value.length >= max;
  const descriptionOf = (itemId: number) => items.find((item) => item.id === itemId)?.description;

  // Suggestions while typing, each with its description: names starting with the text first.
  const needle = text.trim().toLowerCase();
  const suggestions = items
    .filter((item) => !chosen.has(item.id))
    .filter((item) => !needle || item.name.toLowerCase().includes(needle))
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().startsWith(needle)) -
        Number(a.name.toLowerCase().startsWith(needle)),
    )
    .slice(0, 8);
  const listOpen = suggesting && !full && suggestions.length > 0;
  const listId = `${id}-suggestions`;

  const pick = (item: PickableItem) => {
    add({ id: item.id, name: item.name });
    setText("");
    setActive(-1);
  };

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
      <legend className="font-semibold text-deep-sea">{label} (optional)</legend>

      {value.length > 0 && (
        <ul aria-label={`Chosen ${label.toLowerCase()}`} className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li key={item.id}>
              <Tooltip text={descriptionOf(item.id)}>
                {(describedBy) => (
                  <span className="animate-fade-in flex items-center gap-1 rounded-full bg-moss py-1 pl-3 pr-1 text-sm font-medium text-white shadow-sm">
                    {item.name}
                    <button
                      type="button"
                      className="rounded-full px-2 hover:bg-white/20"
                      aria-label={`Remove ${item.name}`}
                      aria-describedby={describedBy}
                      onClick={() => remove(item.id)}
                    >
                      ×
                    </button>
                  </span>
                )}
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      {typical.length > 0 && (
        <div>
          <p className="text-sm text-stone-700">Typical for {craftTypeName}:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {typical.map((item) => (
              <Tooltip key={item.id} text={item.description}>
                {(describedBy) => (
                  <label className="relative flex cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium transition-all hover:border-moss has-[:checked]:border-moss has-[:checked]:bg-moss-wash has-[:checked]:text-moss-dark has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-lapis">
                    <input
                      className="peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none opacity-0"
                      type="checkbox"
                      checked={chosen.has(item.id)}
                      disabled={full && !chosen.has(item.id)}
                      aria-describedby={describedBy}
                      onChange={(event) =>
                        event.target.checked
                          ? add({ id: item.id, name: item.name })
                          : remove(item.id)
                      }
                    />
                    <Check
                      aria-hidden="true"
                      className="hidden h-3.5 w-3.5 peer-checked:block"
                      strokeWidth={3}
                    />
                    {item.name}
                  </label>
                )}
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor={`${id}-other`} className="block text-sm font-medium text-stone-800">
          {typical.length ? `Other ${label.toLowerCase()}` : `Find a ${noun}`}
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              id={`${id}-other`}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
              autoComplete="off"
              value={text}
              maxLength={80}
              disabled={full}
              placeholder={`Type to search ${label.toLowerCase()}`}
              aria-describedby={addError ? `${id}-add-error` : undefined}
              className="w-full rounded-sm border px-3.5 py-2.5"
              onChange={(event) => {
                setText(event.target.value);
                setSuggesting(true);
                setActive(-1);
              }}
              onFocus={() => setSuggesting(true)}
              onBlur={() => setSuggesting(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSuggesting(true);
                  setActive((index) => Math.min(index + 1, suggestions.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, -1));
                } else if (event.key === "Escape") {
                  setSuggesting(false);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  if (listOpen && active >= 0) pick(suggestions[active]);
                  else void addTyped();
                }
              }}
            />
            {listOpen && (
              <ul
                id={listId}
                role="listbox"
                aria-label={`Matching ${label.toLowerCase()}`}
                className="animate-fade-up absolute inset-x-0 top-full z-[1060] mt-1 max-h-80 overflow-y-auto rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-stone-200"
              >
                {suggestions.map((item, index) => (
                  <li
                    key={item.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    aria-label={item.name}
                    aria-describedby={item.description ? `${listId}-${index}-d` : undefined}
                    className={`cursor-pointer rounded-sm px-3 py-2.5 ${
                      index === active ? "bg-sky-wash" : ""
                    }`}
                    // Keep the focus in the input, so the list does not close before the click.
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(index)}
                    onClick={() => pick(item)}
                  >
                    <span className="flex items-center gap-2 font-medium text-deep-sea">
                      {item.name}
                      {item.typical && craftTypeName && (
                        <span className="rounded-full bg-moss-wash px-2 py-0.5 text-xs font-semibold text-moss-dark">
                          Typical
                        </span>
                      )}
                    </span>
                    {item.description && (
                      <span
                        id={`${listId}-${index}-d`}
                        className="mt-0.5 block text-sm leading-snug text-stone-600"
                      >
                        {item.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {text.trim() && (
            <button
              type="button"
              disabled={pending || full || (match !== undefined && chosen.has(match.id))}
              className="btn-secondary"
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

      <AddItemInline
        noun={noun}
        disabled={full}
        onAdd={async (name, _homeland, description) => add(await onCreate(name, description))}
      />

      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
