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
import { FormProgress } from "../form/FormProgress";
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lagoon">Share a craft</p>
      <h1 className="mt-2 text-4xl font-semibold">Add a craft</h1>
      <p className="mt-2 max-w-2xl text-stone-700">
        Your craft is published right away. Other users can report content that is inaccurate or
        disrespectful.
      </p>
      {showDraftNotice && (
        <div
          role="status"
          className="animate-fade-up mt-6 flex items-center justify-between gap-4 rounded-xl bg-sky-wash px-4 py-3 ring-1 ring-brand-200"
        >
          <p className="text-sm">
            We restored your unsaved draft. Media files are not kept in drafts.
          </p>
          <button
            type="button"
            className="btn-secondary"
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
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <FormProgress form={form} withMedia />
          </div>
        </aside>
        <form noValidate onSubmit={onSubmit} className="min-w-0 space-y-6">
          <FormAlert>{formError}</FormAlert>
          <CraftFields form={form} />

          <section
            id="section-media"
            aria-labelledby="media-heading"
            className="form-section space-y-4"
          >
            <h2 id="media-heading" className="text-2xl font-semibold">
              Photos, videos, and documents
            </h2>
            {media.length > 0 && (
              <ul className="space-y-2">
                {media.map((item, index) => (
                  <li
                    key={`${describeMedia(item)}-${index}`}
                    className="animate-fade-up flex items-center justify-between rounded-sm bg-mist px-4 py-2.5 ring-1 ring-stone-200"
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

          <div className="sticky bottom-0 z-[1040] -mx-1 flex items-center justify-between gap-4 rounded-t-xl border-t border-stone-200 bg-white/90 px-5 py-4 shadow-lg backdrop-blur">
            <p className="hidden text-sm text-stone-600 sm:block">
              You can edit your craft at any time after publishing.
            </p>
            <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Publishing…">
              Publish craft
            </SubmitButton>
          </div>
        </form>
      </div>
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
