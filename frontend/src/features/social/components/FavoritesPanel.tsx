import { Link } from "react-router";

import { useAuth } from "@/features/auth/context";
import { placeName } from "@/features/crafts/place";

import { useMyFavorites } from "../queries";

import { Panel } from "./Panel";

const SHOWN = 8;

export function FavoritesPanel() {
  const auth = useAuth();
  const signedIn = auth.status === "authenticated";
  const favorites = useMyFavorites(1, signedIn);

  if (auth.status === "loading") {
    return null;
  }

  if (!signedIn) {
    return (
      <Panel title="Your favorites">
        <p className="text-sm text-stone-700">
          Log in and favorite crafts to keep them here, next to the map.
        </p>
        <Link
          to="/login"
          className="mt-3 inline-block text-sm font-medium text-brand-700 underline"
        >
          Log in to see your favorites
        </Link>
      </Panel>
    );
  }

  const items = favorites.data?.items ?? [];
  const total = favorites.data?.total ?? 0;

  return (
    <Panel
      title="Your favorites"
      action={
        total > 0 && (
          <Link to="/me/favorites" className="text-sm text-brand-700 underline">
            View all ({total})
          </Link>
        )
      }
    >
      {favorites.isPending ? (
        <p className="text-sm text-stone-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone-600">
          No favorites yet. Open a craft and press Favorite to keep it here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, SHOWN).map((craft) => (
            <li key={craft.id}>
              <Link
                to={`/crafts/${craft.id}`}
                className="flex items-center gap-3 rounded p-1 hover:bg-brand-50"
              >
                {craft.cover_photo ? (
                  <img
                    src={craft.cover_photo.url}
                    alt=""
                    width={48}
                    height={36}
                    loading="lazy"
                    className="h-9 w-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="h-9 w-12 shrink-0 rounded bg-brand-100" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{craft.name}</span>
                  <span className="block truncate text-xs text-stone-600">{placeName(craft)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
