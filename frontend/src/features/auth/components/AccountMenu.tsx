import { Link, useNavigate } from "react-router";

import { useAuth } from "../context";

export function AccountMenu() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.status === "loading") {
    return null;
  }

  if (auth.status === "guest") {
    return (
      <>
        <Link
          to="/register"
          className="rounded px-3 py-2 text-sm font-medium text-stone-700 hover:bg-brand-100"
        >
          Register
        </Link>
        <Link
          to="/login"
          className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Log in
        </Link>
      </>
    );
  }

  return (
    <>
      {auth.user.role === "admin" && (
        <Link
          to="/admin/reports"
          className="rounded px-3 py-2 text-sm font-medium text-stone-700 hover:bg-brand-100"
        >
          Review reports
        </Link>
      )}
      <Link
        to="/me/favorites"
        className="rounded px-3 py-2 text-sm font-medium text-stone-700 hover:bg-brand-100"
      >
        Favorites
      </Link>
      <Link
        to="/me"
        className="rounded px-3 py-2 text-sm font-medium text-stone-700 hover:bg-brand-100"
      >
        {auth.user.display_name}
      </Link>
      <button
        type="button"
        className="rounded px-3 py-2 text-sm font-medium text-stone-700 hover:bg-brand-100"
        onClick={async () => {
          await auth.logout();
          navigate("/");
        }}
      >
        Log out
      </button>
    </>
  );
}
