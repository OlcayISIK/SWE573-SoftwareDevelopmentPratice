import { useState } from "react";
import { Link } from "react-router";

import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";
import { CraftGrid } from "@/features/crafts/components/CraftCard";

import { useMyFavorites } from "../queries";

export function MyFavoritesPage() {
  const [page, setPage] = useState(1);
  const favorites = useMyFavorites(page);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-semibold">Your favorites</h1>
      {favorites.isPending ? (
        <PageLoader label="Loading favorites" />
      ) : favorites.isError ? (
        <p role="alert" className="mt-6">
          Your favorites could not be loaded.
        </p>
      ) : favorites.data.items.length === 0 ? (
        <p className="mt-6 text-stone-700">
          You have not favorited any crafts yet.{" "}
          <Link to="/" className="font-medium text-brand-700 underline">
            Explore the map
          </Link>
        </p>
      ) : (
        <div className="mt-6">
          <CraftGrid crafts={favorites.data.items} />
          <Pagination page={page} totalPages={favorites.data.totalPages} onChange={setPage} />
        </div>
      )}
    </section>
  );
}
