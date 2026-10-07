import { useId, type ComponentProps, type ReactNode } from "react";

type TextAreaFieldProps = ComponentProps<"textarea"> & {
  label: string;
  error?: string;
  hint?: ReactNode;
};

export function TextAreaField({
  label,
  error,
  hint,
  className = "",
  ...textarea
}: TextAreaFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-stone-600">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={`mt-1 block w-full rounded border px-3 py-2 ${
          error ? "border-red-600" : "border-stone-300"
        }`}
        {...textarea}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
