import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/features/auth/context";
import { applyServerErrors } from "@/lib/forms";
import { toast } from "@/lib/toast";

import { CraftFields } from "../form/CraftFields";
import { MediaPicker } from "../form/MediaPicker";
import {
  CRAFT_FORM_FIELDS,
  craftFormSchema,
  fromCraft,
  toPayload,
  type CraftFormValues,
} from "../form/schema";
import { useCraft, useMediaMutations, useUpdateCraft } from "../queries";
import type { CraftDetail, CraftMedia } from "../types";

function mediaLabel(item: CraftMedia) {
  if (item.media_type === "photo") return `Photo: ${item.alt_text}`;
  if (item.media_type === "video") return `Video: ${item.caption || item.url}`;
  return `Document: ${item.caption || "PDF"}`;
}

function MediaManager({ craft, canAdd }: { craft: CraftDetail; canAdd: boolean }) {
  const { add, remove } = useMediaMutations(craft.id);
  const [removing, setRemoving] = useState<CraftMedia | null>(null);

  return (
    <section aria-labelledby="manage-media-heading" className="mt-12 space-y-4">
      <h2 id="manage-media-heading" className="text-lg font-semibold">
        Photos, videos, and documents
      </h2>
      {craft.media.length === 0 ? (
        <p className="text-stone-700">No media yet.</p>
      ) : (
        <ul className="space-y-2">
          {craft.media.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 rounded border border-stone-300 bg-white px-3 py-2"
            >
              <span className="flex items-center gap-3">
                {item.media_type === "photo" && item.file && (
                  <img
                    src={item.file}
                    alt=""
                    width={64}
                    height={48}
                    className="h-12 w-16 object-cover"
                  />
                )}
                {mediaLabel(item)}
              </span>
              <button
                type="button"
                className="text-sm font-medium text-red-800 underline"
                onClick={() => setRemoving(item)}
              >
                Remove <span className="sr-only">{mediaLabel(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <MediaPicker
          onAdd={(media) =>
            add.mutate(
              { media, order: craft.media.length },
              { onSuccess: () => toast.success("Media added.") },
            )
          }
        />
      )}
      {add.isPending && (
        <p role="status" className="text-sm">
          Uploading…
        </p>
      )}
      {add.isError && <FormAlert>{toApiError(add.error).message}</FormAlert>}
      {removing && (
        <ConfirmDialog
          title="Remove this media item?"
          confirmLabel="Remove"
          tone="danger"
          pending={remove.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => remove.mutate(removing.id, { onSettled: () => setRemoving(null) })}
        >
          {mediaLabel(removing)} will be removed from this craft.
        </ConfirmDialog>
      )}
    </section>
  );
}

function EditCraftForm({ craft }: { craft: CraftDetail }) {
  const navigate = useNavigate();
  const update = useUpdateCraft(craft.id);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CraftFormValues>({
    resolver: zodResolver(craftFormSchema),
    defaultValues: fromCraft(craft),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await update.mutateAsync(toPayload(values));
      toast.success("Your changes are saved.");
      navigate(`/crafts/${craft.id}`);
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, CRAFT_FORM_FIELDS));
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="mt-8 space-y-10">
      <FormAlert>{formError}</FormAlert>
      <CraftFields form={form} craft={craft} />
      <div className="flex gap-4">
        <SubmitButton pending={form.formState.isSubmitting}>Save changes</SubmitButton>
        <Link to={`/crafts/${craft.id}`} className="px-4 py-2 font-medium text-brand-700 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function EditCraftPage() {
  const { id } = useParams();
  const craftId = Number(id);
  const valid = Number.isInteger(craftId) && craftId > 0;
  const craft = useCraft(valid ? craftId : null);
  const auth = useAuth();

  if (!valid || (craft.isError && toApiError(craft.error).status === 404)) {
    return <NotFoundPage title="Craft not found" message="This craft does not exist." />;
  }
  if (craft.isPending || auth.status !== "authenticated") {
    return <PageLoader label="Loading the craft" />;
  }
  if (craft.isError) {
    return (
      <p role="alert" className="mx-auto max-w-3xl px-4 py-12">
        This craft could not be loaded.
      </p>
    );
  }

  const isAuthor = craft.data.author.id === auth.user.id;
  if (!isAuthor && auth.user.role !== "admin") {
    return (
      <section role="alert" className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-3 text-stone-700">Only the author or an admin can edit this craft.</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Edit “{craft.data.name}”</h1>
      <EditCraftForm craft={craft.data} />
      <MediaManager craft={craft.data} canAdd={isAuthor} />
    </section>
  );
}
