import { Link, useLocation } from "react-router";

const buttonClass =
  "inline-flex items-center gap-2 rounded border border-stone-300 bg-white px-4 py-2 font-medium hover:bg-brand-100";

/** Guests see what the action would do, and a link that brings them back after logging in. */
export function SignInPrompt({ label }: { label: string }) {
  const location = useLocation();
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  return (
    <Link to={`/login?next=${next}`} className={buttonClass}>
      {label}
    </Link>
  );
}
