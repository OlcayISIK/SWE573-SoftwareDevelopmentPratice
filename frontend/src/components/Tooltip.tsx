import { useEffect, useId, useState, type ReactNode } from "react";

interface TooltipProps {
  /** The text to show. Without it, only the children are rendered. */
  text: string | undefined;
  /** Renders the target. Pass `describedBy` to its focusable element as aria-describedby. */
  children: (describedBy: string | undefined) => ReactNode;
}

/**
 * Shows a short text above its target while the pointer is over it or it has focus. The text
 * can be hovered without closing it, and Escape closes it.
 */
export function Tooltip({ text, children }: TooltipProps) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);

  // Escape hides the text until the pointer or focus leaves, also when it was opened by
  // hovering and the focus is elsewhere.
  useEffect(() => {
    if (!text) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [text]);

  if (!text) return <>{children(undefined)}</>;

  return (
    <span
      className="group relative inline-flex"
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {children(id)}
      {/* The padding keeps the pointer over the group while it moves onto the text. */}
      <span
        id={id}
        role="tooltip"
        className={`invisible absolute bottom-full left-0 z-30 w-max max-w-xs pb-1 opacity-0 transition-opacity ${
          dismissed
            ? ""
            : "group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
        }`}
      >
        <span className="block rounded bg-stone-900 px-3 py-2 text-left text-sm font-normal text-white shadow-lg">
          {text}
        </span>
      </span>
    </span>
  );
}
