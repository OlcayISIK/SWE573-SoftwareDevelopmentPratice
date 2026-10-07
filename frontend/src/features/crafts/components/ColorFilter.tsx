import { useEffect, useId, useRef, useState } from "react";

const SETTLE_MS = 400;
// What the picker shows before any color is chosen.
const PICKER_START = "#1e40af";

/**
 * Picks a color to find crafts with a similar one. The browser's picker reports every step while
 * the user drags, so the filter changes only once the choice settles.
 */
export function ColorFilter({
  value,
  onChange,
}: {
  /** rrggbb, without "#". */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const id = useId();
  // A pick that has not settled yet.
  const [pending, setPending] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      onChangeRef.current(pending.slice(1).toLowerCase());
      setPending(null);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    <div>
      <label htmlFor={`${id}-color`} className="text-sm font-medium">
        Similar color
      </label>
      <div className="mt-1 flex h-[42px] items-center gap-2">
        <input
          id={`${id}-color`}
          type="color"
          className="h-10 w-12 cursor-pointer rounded border border-stone-300 bg-white"
          value={pending ?? (value ? `#${value}` : PICKER_START)}
          onChange={(event) => setPending(event.target.value)}
        />
        {value ? (
          <button
            type="button"
            className="text-sm font-medium text-brand-700 underline"
            onClick={() => onChange(undefined)}
          >
            Any color
          </button>
        ) : (
          <span className="text-sm text-stone-600">Any</span>
        )}
      </div>
    </div>
  );
}
