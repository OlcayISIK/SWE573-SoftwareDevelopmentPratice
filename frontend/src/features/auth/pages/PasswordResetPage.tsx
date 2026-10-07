import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextField } from "@/components/form/TextField";
import { applyServerErrors } from "@/lib/forms";

import { authApi } from "../api";
import {
  newPasswordSchema,
  passwordResetRequestSchema,
  type NewPasswordValues,
  type PasswordResetRequestValues,
} from "../schemas";

function RequestResetForm() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetRequestValues>({ resolver: zodResolver(passwordResetRequestSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    const response = await authApi.requestPasswordReset(email).catch(() => null);
    if (response) {
      setSentMessage(response.detail);
    }
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-stone-700">
        Enter your email address and we will send you a link to choose a new password.
      </p>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormAlert tone="success">{sentMessage}</FormAlert>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <SubmitButton pending={isSubmitting} pendingLabel="Sending…" className="w-full">
          Send reset link
        </SubmitButton>
      </form>
    </>
  );
}

function ChooseNewPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({ resolver: zodResolver(newPasswordSchema) });

  const onSubmit = handleSubmit(async ({ new_password }) => {
    setFormError(null);
    try {
      await authApi.confirmPasswordReset({ uid, token, new_password });
      setDone(true);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["new_password"]));
    }
  });

  if (done) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Password changed</h1>
        <FormAlert tone="success">
          Your password has been reset and you have been signed out everywhere.
        </FormAlert>
        <Link to="/login" className="mt-6 inline-block font-medium text-brand-700 underline">
          Log in with your new password
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <FormAlert>{formError}</FormAlert>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.new_password?.message}
          {...register("new_password")}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm_password?.message}
          {...register("confirm_password")}
        />
        <SubmitButton pending={isSubmitting} className="w-full">
          Set new password
        </SubmitButton>
      </form>
    </>
  );
}

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      {uid && token ? <ChooseNewPasswordForm uid={uid} token={token} /> : <RequestResetForm />}
    </section>
  );
}
