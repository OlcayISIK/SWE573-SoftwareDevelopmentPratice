import { Link } from "react-router";

import { useAuth } from "@/features/auth/context";
import { Avatar } from "@/features/profiles/components/Avatar";

import type { FollowEntry } from "../api";
import { useMyFollowers, useMyFollowing } from "../queries";

import { Panel } from "./Panel";

const SHOWN = 6;

function PeopleList({ entries, empty }: { entries: FollowEntry[]; empty: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-stone-600">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.slice(0, SHOWN).map(({ user }) => (
        <li key={user.id}>
          <Link
            to={`/users/${user.id}`}
            className="flex items-center gap-3 rounded-sm p-1.5 transition-colors hover:bg-sky-wash/60"
          >
            <Avatar src={user.avatar} name={user.display_name} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.display_name}</span>
              {(user.city || user.country) && (
                <span className="block truncate text-xs text-stone-600">
                  {[user.city, user.country].filter(Boolean).join(", ")}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Count({ total }: { total?: number }) {
  return total === undefined ? null : <span className="text-sm text-stone-600">{total}</span>;
}

export function PeoplePanel() {
  const auth = useAuth();
  const signedIn = auth.status === "authenticated";
  const following = useMyFollowing(signedIn);
  const followers = useMyFollowers(signedIn);

  if (auth.status === "loading") {
    return null;
  }

  if (!signedIn) {
    return (
      <Panel title="Follow contributors">
        <p className="text-sm text-stone-700">
          Follow people whose crafts you like and get notified when they add new ones.
        </p>
        <div className="mt-3 flex flex-col gap-2 text-sm font-medium">
          <Link
            to="/login"
            className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
          >
            Log in to follow contributors
          </Link>
          <Link
            to="/register"
            className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
          >
            Create an account
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel title="People you follow" action={<Count total={following.data?.total} />}>
        <PeopleList
          entries={following.data?.items ?? []}
          empty="You are not following anyone yet. Follow contributors from their profile."
        />
      </Panel>
      <Panel title="Your followers" action={<Count total={followers.data?.total} />}>
        <PeopleList entries={followers.data?.items ?? []} empty="No followers yet." />
      </Panel>
    </div>
  );
}
