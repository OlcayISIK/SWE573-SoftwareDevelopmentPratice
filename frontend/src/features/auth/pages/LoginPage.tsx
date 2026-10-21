import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextField } from "@/components/form/TextField";

import { safeNextPath, useAuth } from "../context";
import { loginSchema, type LoginValues } from "../schemas";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  if (auth.status === "authenticated") {
    return <Navigate to={next} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await auth.login(values);
      navigate(next, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 401) {
        setFormError("Incorrect email or password.");
      } else if (apiError.status === 400) {
        setFormError(apiError.message);
      }
    }
  });

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-4xl font-semibold">Log in</h1>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormAlert>{formError}</FormAlert>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Logging in…" className="w-full">
          Log in
        </SubmitButton>
      </form>
      <p className="mt-6 text-sm">
        <Link
          to="/password-reset"
          className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
        >
          Forgot your password?
        </Link>
      </p>
    </section>
  );
}
