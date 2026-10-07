import { Link } from "react-router";

import { useAuth } from "@/features/auth/context";

import { Avatar } from "../components/Avatar";
import { UserCrafts } from "../components/UserCrafts";
import { formatJoined, formatLocation } from "../format";

export function MyProfilePage() {
  const auth = useAuth();
  if (auth.status !== "authenticated") {
    return null;
  }
  const user = auth.user;
  const location = formatLocation(user.city, user.country);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center gap-6">
        <Avatar src={user.avatar} name={user.display_name} />
        <div className="flex-1">
          <h1 className="text-3xl font-semibold">{user.display_name}</h1>
          {location && <p className="mt-1 text-stone-700">{location}</p>}
          <p className="mt-1 text-sm text-stone-600">{formatJoined(user.date_joined)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/me/settings"
            className="rounded bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-900"
          >
            Edit profile and privacy
          </Link>
          <Link
            to={`/users/${user.id}`}
            className="rounded border border-stone-300 bg-white px-4 py-2 font-medium hover:bg-brand-100"
          >
            View public profile
          </Link>
        </div>
      </header>

      <dl className="mt-8 grid gap-x-6 gap-y-2 rounded-lg border border-brand-100 bg-white p-5 sm:grid-cols-[12rem_1fr]">
        <dt className="font-medium">Email</dt>
        <dd>
          {user.email}{" "}
          <span className="text-sm text-stone-600">
            ({user.show_email ? "visible to others" : "hidden from others"})
          </span>
        </dd>
        <dt className="font-medium">Email verification</dt>
        <dd>{user.is_email_verified ? "Verified" : "Not verified yet"}</dd>
        <dt className="font-medium">Role</dt>
        <dd>{user.role === "admin" ? "Admin" : "Registered user"}</dd>
      </dl>
      {user.bio && <p className="mt-6 max-w-3xl whitespace-pre-line">{user.bio}</p>}
      <UserCrafts userId={user.id} heading="Your crafts" />
    </section>
  );
}
