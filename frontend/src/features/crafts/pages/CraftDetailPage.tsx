import { lazy, Suspense, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/features/auth/context";
import { ReportButton } from "@/features/moderation/components/ReportDialog";
import { FavoriteButton } from "@/features/social/components/FavoriteButton";
import { toast } from "@/lib/toast";

import type { CraftAttributes } from "../attributes";
import { AttributeList } from "../components/detail/AttributeList";
import { CraftFacts } from "../components/detail/CraftFacts";
import { PhotoGallery } from "../components/detail/PhotoGallery";
import { Documents, Videos } from "../components/detail/VideosAndDocuments";
import { placeName } from "../place";
import { useCraft, useDeleteCraft } from "../queries";
import type { CraftDetail } from "../types";

const MapView = lazy(() => import("../components/map/MapView"));

function OwnerActions({ craft }: { craft: CraftDetail }) {
  const navigate = useNavigate();
  const deleteCraft = useDeleteCraft();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex gap-3">
      <Link
        to={`/crafts/${craft.id}/edit`}
        className="rounded border border-stone-300 bg-white px-4 py-2 font-medium hover:bg-brand-100"
      >
        Edit
      </Link>
      <button
        type="button"
        className="rounded border border-red-300 bg-white px-4 py-2 font-medium text-red-800 hover:bg-red-50"
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this craft?"
          confirmLabel="Delete craft"
          tone="danger"
          pending={deleteCraft.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            deleteCraft.mutate(craft.id, {
              onSuccess: () => {
                toast.success(`“${craft.name}” was deleted.`);
                navigate("/crafts", { replace: true });
              },
              onError: () => setConfirming(false),
            })
          }
        >
          “{craft.name}” will be removed from the map and from search. This cannot be undone from
          the site.
        </ConfirmDialog>
      )}
    </div>
  );
}

export function CraftDetailPage() {
  const { id } = useParams();
  const craftId = Number(id);
  const valid = Number.isInteger(craftId) && craftId > 0;
  const craft = useCraft(valid ? craftId : null);
  const auth = useAuth();

  if (!valid || (craft.isError && toApiError(craft.error).status === 404)) {
    return (
      <NotFoundPage
        title="Craft not found"
        message="This craft does not exist or is no longer available."
      />
    );
  }
  if (craft.isPending) {
    return <PageLoader label="Loading the craft" />;
  }
  if (craft.isError) {
    return (
      <p role="alert" className="mx-auto max-w-4xl px-4 py-12 text-stone-700">
        This craft could not be loaded.
      </p>
    );
  }

  const data = craft.data;
  const photos = data.media.filter((item) => item.media_type === "photo");
  const videos = data.media.filter((item) => item.media_type === "video");
  const documents = data.media.filter((item) => item.media_type === "document");
  const canManage =
    auth.status === "authenticated" &&
    (auth.user.id === data.author.id || auth.user.role === "admin");

  return (
    <article className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-700">
            {data.category.name} · {data.craft_type.name}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{data.name}</h1>
          <p className="mt-2 text-stone-700">
            {data.culture && <>{data.culture.name} · </>}
            {placeName(data) && <>From {placeName(data)} · </>}
            Added by{" "}
            <Link to={`/users/${data.author.id}`} className="underline">
              {data.author.display_name}
            </Link>
          </p>
          {data.status === "hidden" && (
            <p className="mt-3 inline-block rounded bg-stone-200 px-3 py-1 text-sm font-medium">
              Hidden by a moderator. Only you and admins can see it.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <FavoriteButton craftId={data.id} />
          <ReportButton craftId={data.id} authorId={data.author.id} />
          {canManage && <OwnerActions craft={data} />}
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div>
          <PhotoGallery photos={photos} />
          <section className="mt-10">
            <h2 className="text-xl font-semibold">About this craft</h2>
            <p className="mt-3 whitespace-pre-line text-stone-800">{data.description}</p>
          </section>
          <AttributeList attributes={data.attributes as CraftAttributes} />
          <Videos videos={videos} craftName={data.name} />
          <Documents documents={documents} />
        </div>

        <aside aria-label="Facts and location" className="space-y-6">
          <CraftFacts craft={data} />
          <section className="overflow-hidden rounded-lg border border-brand-100 bg-white">
            <h2 className="px-5 pt-4 text-lg font-semibold">Location</h2>
            <p className="px-5 pt-1 text-stone-700">{data.address}</p>
            <div className="mt-3 h-64">
              <Suspense fallback={<PageLoader label="Loading the map" />}>
                <MapView
                  pins={[
                    {
                      id: data.id,
                      name: data.name,
                      category: data.category.slug,
                      latitude: data.latitude,
                      longitude: data.longitude,
                    },
                  ]}
                  onSelect={() => undefined}
                  focus={[data.latitude, data.longitude]}
                />
              </Suspense>
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
