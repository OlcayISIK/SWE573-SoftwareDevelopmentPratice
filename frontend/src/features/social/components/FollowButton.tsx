import { useAuth } from "@/features/auth/context";

import { useFollowStatus, useToggleFollow } from "../queries";

import { SignInPrompt } from "./SignInPrompt";

export function FollowSummary({ userId }: { userId: number }) {
  const status = useFollowStatus(userId);
  if (!status.data) {
    return null;
  }
  return (
    <p className="text-sm text-stone-700">
      <strong>{status.data.followers_count}</strong>{" "}
      {status.data.followers_count === 1 ? "follower" : "followers"} ·{" "}
      <strong>{status.data.following_count}</strong> following
    </p>
  );
}

export function FollowButton({ userId, name }: { userId: number; name: string }) {
  const auth = useAuth();
  const status = useFollowStatus(userId);
  const toggle = useToggleFollow(userId);

  if (auth.status === "authenticated" && auth.user.id === userId) {
    return null;
  }
  if (auth.status === "guest") {
    return <SignInPrompt label={`Log in to follow ${name}`} />;
  }

  const following = status.data?.following ?? false;
  return (
    <button
      type="button"
      aria-pressed={following}
      disabled={!status.data}
      onClick={() => toggle.mutate(!following)}
      className={`rounded border px-4 py-2 font-medium disabled:opacity-60 ${
        following
          ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-900"
          : "border-stone-300 bg-white hover:bg-brand-100"
      }`}
    >
      {following ? "Following" : "Follow"} <span className="sr-only">{name}</span>
    </button>
  );
}
