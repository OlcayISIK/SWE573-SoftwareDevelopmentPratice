import { Link, useNavigate } from "react-router";

import { NotificationBell } from "@/features/notifications/components/NotificationBell";

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
        <Link to="/register" className="btn-ghost font-medium">
          Register
        </Link>
        <Link to="/login" className="btn-secondary">
          Log in
        </Link>
      </>
    );
  }

  return (
    <>
      {auth.user.role === "admin" && (
        <Link to="/admin/reports" className="btn-ghost font-medium">
          Review reports
        </Link>
      )}
      <NotificationBell />
      <Link to="/me/favorites" className="btn-ghost font-medium">
        Favorites
      </Link>
      <Link to="/me" className="btn-ghost font-medium">
        {auth.user.display_name}
      </Link>
      <button
        type="button"
        className="btn-ghost font-medium"
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
