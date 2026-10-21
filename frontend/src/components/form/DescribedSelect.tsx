/* eslint-disable jsx-a11y/click-events-have-key-events -- options get their keys from the
   focused input or list, through aria-activedescendant, as the ARIA combobox pattern asks. */
import { Check, ChevronDown, Search } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

export interface DescribedOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface DescribedSelectProps {
  label: string;
  value: string;
  options: DescribedOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled?: boolean;
  error?: string;
  hint?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Long lists get a filter box at the top of the list. */
const FILTER_FROM = 8;

/**
 * A dropdown whose options show a description under their name, which a native <select> cannot.
 * It follows the ARIA select-only combobox pattern: arrow keys move, Enter or Space chooses, and
 * Escape closes. Long lists can be filtered by typing.
 */
export function DescribedSelect({
  label,
  value,
  options,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
  error,
  hint,
  ref,
}: DescribedSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((option) =>
        `${option.label} ${option.description ?? ""}`.toLowerCase().includes(needle),
      )
    : options;
  const withFilter = options.length >= FILTER_FROM;

  const close = (focusTrigger = true) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  };

  const openList = () => {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  };

  const choose = (option: DescribedOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    close();
  };

  // Focus moves into the list, or its filter box, when it opens.
  useEffect(() => {
    if (!open) return;
    (withFilter ? filterRef.current : listRef.current)?.focus();
  }, [open, withFilter]);

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close(false);
        onBlur?.();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  // Keep the highlighted option in view while moving with the keys.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, listId]);

  const onListKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(shown.length - 1);
    } else if (event.key === "Enter" || (event.key === " " && !withFilter)) {
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close(event.key === "Escape");
    }
  };

  const activeId = open && shown[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="block text-sm font-semibold text-deep-sea">
        {label}
      </label>
      <button
        id={id}
        ref={(element) => {
          triggerRef.current = element;
          if (typeof ref === "function") ref(element);
          else if (ref) ref.current = element;
        }}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        disabled={disabled}
        className={`mt-1.5 flex w-full items-center gap-2 rounded-sm border bg-white px-3.5 py-2.5 text-left transition-shadow disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500 ${
          error ? "border-red-600" : "border-outline"
        } ${open ? "border-lapis ring-4 ring-lapis/15" : ""}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openList();
          }
        }}
        onBlur={() => !open && onBlur?.()}
      >
        {selected?.icon}
        <span className={`flex-1 truncate ${selected ? "" : "text-stone-500"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-stone-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      {open && (
        <div className="animate-fade-up absolute inset-x-0 top-full z-[1060] mt-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-stone-200">
          {withFilter && (
            <div className="relative border-b border-stone-100 p-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
              />
              <input
                ref={filterRef}
                type="text"
                role="searchbox"
                aria-label={`Filter ${label.toLowerCase()}`}
                aria-controls={listId}
                aria-activedescendant={activeId}
                placeholder="Type to filter"
                value={query}
                className="w-full rounded-sm border px-3 py-2 pl-9 text-sm"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKeyDown}
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={withFilter ? undefined : activeId}
            tabIndex={-1}
            className="max-h-80 overflow-y-auto p-1.5 outline-none"
            onKeyDown={withFilter ? undefined : onListKeyDown}
          >
            {shown.length === 0 && (
              <li className="px-3 py-3 text-sm text-stone-600">Nothing matches “{query}”.</li>
            )}
            {shown.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={option.label}
                  aria-describedby={option.description ? `${listId}-${index}-d` : undefined}
                  className={`flex cursor-pointer gap-3 rounded-sm px-3 py-2.5 ${
                    index === active ? "bg-sky-wash" : ""
                  }`}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                >
                  {option.icon && <span className="mt-0.5 shrink-0">{option.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-deep-sea">{option.label}</span>
                    {option.description && (
                      <span
                        id={`${listId}-${index}-d`}
                        className="mt-0.5 block text-sm leading-snug text-stone-600"
                      >
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
