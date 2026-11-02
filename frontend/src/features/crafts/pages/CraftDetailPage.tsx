import { MapPin, Pencil, Trash2, User, Users } from "lucide-react";
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
import { categoryStyle } from "../categoryStyle";
import { AttributeList } from "../components/detail/AttributeList";
import { CraftFacts } from "../components/detail/CraftFacts";
import { PhotoGallery } from "../components/detail/PhotoGallery";
import { RichText } from "../components/detail/RichText";
import { Stories } from "../components/detail/Stories";
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
    <div className="flex gap-2">
      <Link to={`/crafts/${craft.id}/edit`} className="btn-secondary">
        <Pencil aria-hidden="true" className="h-4 w-4" />
        Edit
      </Link>
      <button
        type="button"
        className="btn border border-red-200 bg-white text-red-800 hover:border-red-400 hover:bg-red-50"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
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
    return (
      <div role="status" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <span className="sr-only">Loading the craft…</span>
        <div className="skeleton h-4 w-40" />
        <div className="skeleton mt-3 h-10 w-2/3" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
          <div className="skeleton aspect-[4/3] w-full !rounded-xl" />
          <div className="skeleton h-80 w-full !rounded-xl" />
        </div>
      </div>
    );
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

  const { icon: CategoryIcon, color } = categoryStyle(data.category.slug, data.category.icon);

  return (
    <article>
      <header className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-b from-white to-mist">
        <div aria-hidden="true" className="bg-contour animate-drift absolute inset-0 opacity-70" />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 pb-7 pt-8 sm:px-6">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-stone-200"
                style={{ color }}
              >
                <CategoryIcon aria-hidden="true" className="h-4 w-4" />
                {data.category.name} · {data.craft_type.name}
              </span>
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">{data.name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-stone-700">
              {data.culture && (
                <span className="inline-flex items-center gap-1.5">
                  <Users aria-hidden="true" className="h-4 w-4 text-stone-500" />
                  {data.culture.name}
                </span>
              )}
              {placeName(data) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="h-4 w-4 text-stone-500" />
                  From {placeName(data)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <User aria-hidden="true" className="h-4 w-4 text-stone-500" />
                Added by{" "}
                <Link
                  to={`/users/${data.author.id}`}
                  className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
                >
                  {data.author.display_name}
                </Link>
              </span>
            </p>
            {data.status === "hidden" && (
              <p className="mt-3 inline-block rounded-full bg-stone-200 px-3 py-1 text-sm font-medium">
                Hidden by a moderator. Only you and admins can see it.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <FavoriteButton craftId={data.id} />
            <ReportButton craftId={data.id} authorId={data.author.id} />
            {canManage && <OwnerActions craft={data} />}
          </div>
        </div>
      </header>

      <div className="mx-auto mt-8 grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <PhotoGallery photos={photos} />
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">About this craft</h2>
            <RichText text={data.description} className="mt-4 text-lg" />
          </section>
          <Stories craft={data} />
          <AttributeList attributes={data.attributes as CraftAttributes} colors={data.colors} />
          <Videos videos={videos} craftName={data.name} />
          <Documents documents={documents} />
        </div>

        <aside
          aria-label="Facts and location"
          className="space-y-6 lg:sticky lg:top-24 lg:self-start"
        >
          <CraftFacts craft={data} />
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
            <h2 className="px-5 pt-4 text-lg font-semibold">
              {data.places.length > 1 ? "Places" : "Location"}
            </h2>
            <ul className="space-y-1.5 px-5 pt-2 text-stone-700">
              {data.places.map((place) => (
                <li key={place.id} className="flex items-start gap-2">
                  <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                  <span>
                    {place.address}
                    {place.is_origin && (
                      <span className="ml-1.5 rounded-full bg-lagoon-wash px-2 py-0.5 text-xs font-semibold text-lagoon">
                        (origin)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 h-64">
              <Suspense fallback={<PageLoader label="Loading the map" />}>
                <MapView
                  pins={data.places.map((place) => ({
                    id: data.id,
                    place: place.id,
                    name: data.name,
                    category: data.category.slug,
                    category_icon: data.category.icon,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  }))}
                  onSelect={() => undefined}
                  // A craft in one place opens on it; one in several shows them all.
                  focus={data.places.length === 1 ? [data.latitude, data.longitude] : undefined}
                  fit={
                    data.places.length > 1
                      ? data.places.map((place) => [place.latitude, place.longitude])
                      : undefined
                  }
                />
              </Suspense>
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
