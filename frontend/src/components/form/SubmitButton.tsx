import type { ButtonHTMLAttributes } from "react";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingLabel?: string;
};

export function SubmitButton({
  pending = false,
  pendingLabel = "Saving…",
  children,
  className = "",
  ...button
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`rounded bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-900 disabled:opacity-60 ${className}`}
      {...button}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
