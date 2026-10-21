import { Link, useLocation } from "react-router";

const buttonClass = "btn border border-stone-300 bg-white text-stone-800 hover:border-brand-300";

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
