import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/features/auth/context";
import { FollowButton, FollowSummary } from "@/features/social/components/FollowButton";

import { Avatar } from "../components/Avatar";
import { UserCrafts } from "../components/UserCrafts";
import { formatJoined, formatLocation } from "../format";
import { usePublicProfile } from "../queries";

export function PublicProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const valid = Number.isInteger(userId) && userId > 0;
  const profile = usePublicProfile(valid ? userId : null);
  const auth = useAuth();

  if (!valid || (profile.isError && toApiError(profile.error).status === 404)) {
    return (
      <NotFoundPage
        title="Profile unavailable"
        message="This profile does not exist or is no longer available."
      />
    );
  }
  if (profile.isPending) {
    return <PageLoader label="Loading the profile" />;
  }
  if (profile.isError) {
    return (
      <p role="alert" className="mx-auto max-w-4xl px-4 py-12">
        This profile could not be loaded.
      </p>
    );
  }

  const data = profile.data;
  const location = formatLocation(data.city, data.country);
  const isMe = auth.status === "authenticated" && auth.user.id === data.id;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 sm:p-8">
        <div aria-hidden="true" className="bg-contour absolute inset-0 opacity-50" />
        <div aria-hidden="true" className="woven-band absolute inset-x-0 top-0" />
        <div className="relative">
          <Avatar src={data.avatar} name={data.display_name} />
        </div>
        <div className="relative flex-1">
          <h1 className="text-4xl font-semibold">{data.display_name}</h1>
          {location && <p className="mt-1 text-stone-700">{location}</p>}
          {data.email && (
            <p className="mt-1">
              <a
                href={`mailto:${data.email}`}
                className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
              >
                {data.email}
              </a>
            </p>
          )}
          <p className="mt-1 text-sm text-stone-600">{formatJoined(data.date_joined)}</p>
          <div className="mt-2">
            <FollowSummary userId={data.id} />
          </div>
        </div>
        <FollowButton userId={data.id} name={data.display_name} />
        {isMe && (
          <Link to="/me/settings" className="btn-secondary">
            Edit profile
          </Link>
        )}
      </header>
      {data.bio && <p className="mt-6 max-w-3xl whitespace-pre-line text-stone-800">{data.bio}</p>}
      <UserCrafts userId={data.id} heading={`Crafts added by ${data.display_name}`} />
    </section>
  );
}
