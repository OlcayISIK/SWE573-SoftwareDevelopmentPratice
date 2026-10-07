import { useAuth } from "@/features/auth/context";

import { useFavoriteStatus, useToggleFavorite } from "../queries";

import { SignInPrompt } from "./SignInPrompt";

export function FavoriteButton({ craftId }: { craftId: number }) {
  const auth = useAuth();
  const status = useFavoriteStatus(craftId, auth.status === "authenticated");
  const toggle = useToggleFavorite(craftId);

  if (auth.status === "guest") {
    return <SignInPrompt label="Log in to favorite" />;
  }

  const favorited = status.data?.favorited ?? false;
  const count = status.data?.favorites_count ?? 0;

  return (
    <button
      type="button"
      aria-pressed={favorited}
      disabled={!status.data}
      onClick={() => toggle.mutate(!favorited)}
      className={`inline-flex items-center gap-2 rounded border px-4 py-2 font-medium disabled:opacity-60 ${
        favorited
          ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-900"
          : "border-stone-300 bg-white hover:bg-brand-100"
      }`}
    >
      <span aria-hidden="true">{favorited ? "♥" : "♡"}</span>
      {favorited ? "Favorited" : "Favorite"}
      <span className="text-sm opacity-80">
        ({count}
        <span className="sr-only"> {count === 1 ? "person" : "people"} favorited this</span>)
      </span>
    </button>
  );
}
