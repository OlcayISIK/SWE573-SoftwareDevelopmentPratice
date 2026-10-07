import { Navigate, Outlet, useLocation } from "react-router";

import { PageLoader } from "@/components/PageLoader";

import { useAuth } from "../context";

function LoginRedirect() {
  const location = useLocation();
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  return <Navigate to={`/login?next=${next}`} replace />;
}

export function RequireAuth() {
  const auth = useAuth();
  if (auth.status === "loading") {
    return <PageLoader label="Checking your session" />;
  }
  return auth.status === "authenticated" ? <Outlet /> : <LoginRedirect />;
}

export function RequireAdmin() {
  const auth = useAuth();
  if (auth.status === "loading") {
    return <PageLoader label="Checking your session" />;
  }
  if (auth.status === "guest") {
    return <LoginRedirect />;
  }
  if (auth.user.role !== "admin") {
    return (
      <section role="alert" className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-3 text-stone-700">Only admins can open this page.</p>
      </section>
    );
  }
  return <Outlet />;
}
