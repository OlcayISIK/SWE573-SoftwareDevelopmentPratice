import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { PageLoader } from "@/components/PageLoader";

import { authApi } from "../api";
import { ResendVerification } from "../components/ResendVerification";
import { useAuth } from "../context";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") ?? "";
  const token = searchParams.get("token") ?? "";
  const auth = useAuth();
  const { status: authStatus, setUser } = auth;

  const verification = useQuery({
    queryKey: ["auth", "verify-email", uid, token],
    queryFn: () => authApi.verifyEmail({ uid, token }),
    enabled: Boolean(uid && token),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (verification.isSuccess && authStatus === "authenticated") {
      authApi.me().then(setUser, () => undefined);
    }
  }, [verification.isSuccess, authStatus, setUser]);

  if (uid && token && verification.isPending) {
    return <PageLoader label="Verifying your email" />;
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      {verification.isSuccess ? (
        <>
          <h1 className="text-2xl font-semibold">Email verified</h1>
          <p className="mt-3 text-stone-700">
            Your email is confirmed. You can now publish crafts.
          </p>
          <Link
            to={authStatus === "authenticated" ? "/" : "/login"}
            className="mt-6 inline-block font-medium text-brand-700 underline"
          >
            {authStatus === "authenticated" ? "Go to the map" : "Log in"}
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">This link does not work</h1>
          <p role="alert" className="mt-3 text-stone-700">
            The verification link is invalid or has expired. Request a new one below.
          </p>
          <ResendVerification defaultEmail={auth.user?.email ?? ""} />
        </>
      )}
    </section>
  );
}
