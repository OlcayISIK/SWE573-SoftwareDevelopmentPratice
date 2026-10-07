import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { ResendVerification } from "@/features/auth/components/ResendVerification";
import { useAuth } from "@/features/auth/context";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";

import { craftsApi, type NewMedia } from "../api";
import { CraftFields } from "../form/CraftFields";
import { describeMedia } from "../form/describeMedia";
import { MediaPicker } from "../form/MediaPicker";
import {
  CRAFT_FORM_FIELDS,
  craftFormSchema,
  emptyCraftForm,
  toPayload,
  type CraftFormValues,
} from "../form/schema";
import { clearDraft, loadDraft, useDraft } from "../form/useDraft";
import { craftKeys } from "../queries";

interface UploadState {
  label: string;
  progress: number;
  status: "waiting" | "uploading" | "done" | "failed";
}

function VerifyFirst({ email }: { email: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Verify your email to publish</h1>
      <p className="mt-3 text-stone-700">
        Publishing is open to verified accounts. Open the link we emailed to {email}, or request a
        new one below.
      </p>
      <ResendVerification defaultEmail={email} />
    </section>
  );
}

function NewCraftForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft] = useState(loadDraft);
  const form = useForm<CraftFormValues>({
    resolver: zodResolver(craftFormSchema),
    defaultValues: draft ?? emptyCraftForm,
  });
  useDraft(form);
  const [media, setMedia] = useState<NewMedia[]>([]);
  const [uploads, setUploads] = useState<UploadState[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDraftNotice, setShowDraftNotice] = useState(draft !== null);

  const updateUpload = (index: number, change: Partial<UploadState>) =>
    setUploads((current) =>
      current ? current.map((item, i) => (i === index ? { ...item, ...change } : item)) : current,
    );

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    let craftId: number;
    try {
      craftId = (await craftsApi.create(toPayload(values))).id;
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, CRAFT_FORM_FIELDS));
      return;
    }
    clearDraft();

    let failed = 0;
    setUploads(
      media.map((item) => ({ label: describeMedia(item), progress: 0, status: "waiting" })),
    );
    for (const [index, item] of media.entries()) {
      updateUpload(index, { status: "uploading" });
      try {
        await craftsApi.addMedia(craftId, item, index, (progress) =>
          updateUpload(index, { progress }),
        );
        updateUpload(index, { status: "done", progress: 100 });
      } catch {
        failed += 1;
        updateUpload(index, { status: "failed" });
      }
    }
    await queryClient.invalidateQueries({ queryKey: craftKeys.all });

    if (failed) {
      toast.error(
        `Your craft is published, but ${failed} media item${failed > 1 ? "s" : ""} could not be uploaded. You can add them again here.`,
      );
      navigate(`/crafts/${craftId}/edit`, { replace: true });
    } else {
      toast.success("Your craft is published.");
      navigate(`/crafts/${craftId}`, { replace: true });
    }
  });

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Add a craft</h1>
      <p className="mt-2 text-stone-700">
        Your craft is published right away. Other users can report content that is inaccurate or
        disrespectful.
      </p>
      {showDraftNotice && (
        <div
          role="status"
          className="mt-6 flex items-center justify-between rounded bg-brand-100 p-3"
        >
          <p className="text-sm">
            We restored your unsaved draft. Media files are not kept in drafts.
          </p>
          <button
            type="button"
            className="text-sm font-medium underline"
            onClick={() => {
              form.reset(emptyCraftForm);
              clearDraft();
              setShowDraftNotice(false);
            }}
          >
            Start over
          </button>
        </div>
      )}
      <form noValidate onSubmit={onSubmit} className="mt-8 space-y-10">
        <FormAlert>{formError}</FormAlert>
        <CraftFields form={form} />

        <section aria-labelledby="media-heading" className="space-y-4">
          <h2 id="media-heading" className="text-lg font-semibold">
            Photos, videos, and documents
          </h2>
          {media.length > 0 && (
            <ul className="space-y-2">
              {media.map((item, index) => (
                <li
                  key={`${describeMedia(item)}-${index}`}
                  className="flex items-center justify-between rounded border border-stone-300 bg-white px-3 py-2"
                >
                  <span>{describeMedia(item)}</span>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-800 underline"
                    onClick={() => setMedia((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove <span className="sr-only">{describeMedia(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <MediaPicker onAdd={(item) => setMedia((current) => [...current, item])} />
        </section>

        {uploads && uploads.length > 0 && (
          <section aria-label="Upload progress" className="space-y-2">
            {uploads.map((upload, index) => (
              <div key={index}>
                <p className="text-sm">
                  {upload.label}:{" "}
                  {upload.status === "failed" ? "upload failed" : `${upload.progress}%`}
                </p>
                <progress
                  className="w-full"
                  max={100}
                  value={upload.progress}
                  aria-label={`Uploading ${upload.label}`}
                />
              </div>
            ))}
          </section>
        )}

        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Publishing…">
          Publish craft
        </SubmitButton>
      </form>
    </section>
  );
}

export function NewCraftPage() {
  const auth = useAuth();
  if (auth.status !== "authenticated") {
    return null;
  }
  return auth.user.is_email_verified ? <NewCraftForm /> : <VerifyFirst email={auth.user.email} />;
}
