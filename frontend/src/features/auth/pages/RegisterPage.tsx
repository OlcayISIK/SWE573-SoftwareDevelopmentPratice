import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";

import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextField } from "@/components/form/TextField";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";

import { authApi } from "../api";
import { ResendVerification } from "../components/ResendVerification";
import { useAuth } from "../context";
import { registerSchema, type RegisterValues } from "../schemas";

export function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [readyToLogIn, setReadyToLogIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  if (auth.status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  if (registeredEmail && readyToLogIn) {
    return (
      <section className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Your account is ready</h1>
        <p className="mt-3 text-stone-700">
          Log in with <strong>{registeredEmail}</strong> to start adding crafts.
        </p>
        <Link to="/login" className="mt-6 inline-block font-medium text-brand-700 underline">
          Log in
        </Link>
      </section>
    );
  }

  if (registeredEmail) {
    return (
      <section className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-stone-700">
          We sent a verification link to <strong>{registeredEmail}</strong>. Open it to confirm your
          address. You can browse and log in now, and publish crafts once your email is verified.
        </p>
        <Link to="/login" className="mt-6 inline-block font-medium text-brand-700 underline">
          Log in
        </Link>
        <h2 className="mt-10 text-lg font-semibold">Did not get the email?</h2>
        <ResendVerification defaultEmail={registeredEmail} />
      </section>
    );
  }

  const onSubmit = handleSubmit(async ({ email, password, display_name }) => {
    setFormError(null);
    try {
      const account = await authApi.register({ email, password, display_name });
      if (account.is_email_verified) {
        // No verification email is needed, so sign the new user straight in.
        try {
          await auth.login({ email, password });
          toast.success("Welcome! Your account is ready.");
          navigate("/", { replace: true });
          return;
        } catch {
          setReadyToLogIn(true);
        }
      }
      setRegisteredEmail(account.email);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email", "password", "display_name"]));
    }
  });

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-2 text-stone-700">
        An account lets you publish crafts, save favorites, and follow other contributors.
      </p>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          label="Display name (optional)"
          autoComplete="nickname"
          error={errors.display_name?.message}
          {...register("display_name")}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters. Avoid common passwords."
          error={errors.password?.message}
          {...register("password")}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register("confirm_password")}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Creating account…" className="w-full">
          Create account
        </SubmitButton>
      </form>
      <p className="mt-6 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-700 underline">
          Log in
        </Link>
      </p>
    </section>
  );
}
