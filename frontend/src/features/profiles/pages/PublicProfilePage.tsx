import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/features/auth/context";

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
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center gap-6">
        <Avatar src={data.avatar} name={data.display_name} />
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{data.display_name}</h1>
          {location && <p className="mt-1 text-stone-700">{location}</p>}
          {data.email && (
            <p className="mt-1">
              <a href={`mailto:${data.email}`} className="text-brand-700 underline">
                {data.email}
              </a>
            </p>
          )}
          <p className="mt-1 text-sm text-stone-600">{formatJoined(data.date_joined)}</p>
        </div>
        {isMe && (
          <Link
            to="/me/settings"
            className="rounded border border-stone-300 bg-white px-4 py-2 font-medium hover:bg-brand-100"
          >
            Edit profile
          </Link>
        )}
      </header>
      {data.bio && <p className="mt-6 max-w-3xl whitespace-pre-line text-stone-800">{data.bio}</p>}
      <UserCrafts userId={data.id} heading={`Crafts added by ${data.display_name}`} />
    </section>
  );
}
