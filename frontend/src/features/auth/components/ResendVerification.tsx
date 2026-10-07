import { useState } from "react";

import { SubmitButton } from "@/components/form/SubmitButton";
import { TextField } from "@/components/form/TextField";

import { authApi } from "../api";

export function ResendVerification({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="mt-4 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const response = await authApi.resendVerification(email).catch(() => null);
        setPending(false);
        if (response) {
          setMessage(response.detail);
        }
      }}
    >
      <TextField
        label="Email for the new link"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send a new verification email
      </SubmitButton>
      {message && (
        <p role="status" className="text-sm text-stone-700">
          {message}
        </p>
      )}
    </form>
  );
}
