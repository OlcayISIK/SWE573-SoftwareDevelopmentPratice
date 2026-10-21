import { Heart } from "lucide-react";

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
      className={`btn border ${
        favorited
          ? "border-clay bg-clay-wash text-clay hover:bg-clay-wash/70"
          : "border-stone-300 bg-white text-stone-800 hover:border-clay hover:text-clay"
      }`}
    >
      <Heart
        key={String(favorited)}
        aria-hidden="true"
        className={`h-4 w-4 ${favorited ? "animate-pop fill-clay" : ""}`}
      />
      {favorited ? "Favorited" : "Favorite"}
      <span className="text-sm opacity-80">
        ({count}
        <span className="sr-only"> {count === 1 ? "person" : "people"} favorited this</span>)
      </span>
    </button>
  );
}
