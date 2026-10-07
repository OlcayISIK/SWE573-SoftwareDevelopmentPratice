import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";
import { useAuth } from "@/features/auth/context";
import type { CurrentUser } from "@/features/auth/types";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";

import { profilesApi, type ProfileChanges } from "../api";
import { Avatar } from "../components/Avatar";
import { useProfileMutation } from "../queries";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const settingsSchema = z.object({
  display_name: z.string().trim().min(1, "Enter a display name.").max(80),
  bio: z.string().max(1000, "Keep your bio under 1000 characters."),
  city: z.string().trim().max(100),
  country: z.string().trim().max(100),
  show_email: z.boolean(),
});
type SettingsValues = z.infer<typeof settingsSchema>;

function AvatarSettings({ user }: { user: CurrentUser }) {
  const upload = useProfileMutation((file: File) => profilesApi.uploadAvatar(file));
  const remove = useProfileMutation(() => profilesApi.removeAvatar());
  const [error, setError] = useState<string | null>(null);

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold">Profile photo</legend>
      <div className="flex flex-wrap items-center gap-6">
        <Avatar src={user.avatar} name={user.display_name} />
        <div className="space-y-3">
          <TextField
            label="Upload a new photo"
            type="file"
            accept={AVATAR_TYPES.join(",")}
            hint="JPEG, PNG, or WebP, up to 2 MB."
            error={error ?? undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!AVATAR_TYPES.includes(file.type))
                return setError("Use a JPEG, PNG, or WebP image.");
              if (file.size > AVATAR_MAX_BYTES) return setError("Photos must be 2 MB or smaller.");
              setError(null);
              upload.mutate(file, {
                onSuccess: () => toast.success("Profile photo updated."),
                onError: (failure) =>
                  setError(toApiError(failure).fieldErrors.avatar?.join(" ") ?? null),
              });
            }}
          />
          {user.avatar && (
            <button
              type="button"
              className="text-sm font-medium text-red-800 underline"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => toast.success("Profile photo removed."),
                })
              }
            >
              Remove photo
            </button>
          )}
          {upload.isPending && <p role="status">Uploading…</p>}
        </div>
      </div>
    </fieldset>
  );
}

export function SettingsPage() {
  const auth = useAuth();
  const user = auth.status === "authenticated" ? auth.user : null;
  const save = useProfileMutation((changes: ProfileChanges) => profilesApi.updateMe(changes));
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: user
      ? {
          display_name: user.display_name,
          bio: user.bio,
          city: user.city,
          country: user.country,
          show_email: user.show_email,
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  if (!user) {
    return null;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await save.mutateAsync(values);
      toast.success("Your profile is saved.");
    } catch (error) {
      setFormError(
        applyServerErrors(error, setError, [
          "display_name",
          "bio",
          "city",
          "country",
          "show_email",
        ]),
      );
    }
  });

  return (
    <section className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Profile and privacy</h1>
      <div className="mt-8 space-y-10">
        <AvatarSettings user={user} />
        <form noValidate onSubmit={onSubmit} className="space-y-10">
          <FormAlert>{formError}</FormAlert>
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">About you</legend>
            <TextField
              label="Display name"
              error={errors.display_name?.message}
              {...register("display_name")}
            />
            <TextAreaField label="Bio" error={errors.bio?.message} {...register("bio")} />
          </fieldset>
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold">General location</legend>
            <p className="text-sm text-stone-600">
              Only your city and country are shown on your profile. Never enter a street address.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="City"
                autoComplete="address-level2"
                error={errors.city?.message}
                {...register("city")}
              />
              <TextField
                label="Country"
                autoComplete="country-name"
                error={errors.country?.message}
                {...register("country")}
              />
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-lg font-semibold">Privacy</legend>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" {...register("show_email")} />
              <span>
                Show my email address ({user.email}) on my public profile
                <span className="block text-sm text-stone-600">
                  Off by default. Other users can only see your email if you turn this on.
                </span>
              </span>
            </label>
          </fieldset>
          <SubmitButton pending={isSubmitting}>Save profile</SubmitButton>
        </form>
      </div>
    </section>
  );
}
