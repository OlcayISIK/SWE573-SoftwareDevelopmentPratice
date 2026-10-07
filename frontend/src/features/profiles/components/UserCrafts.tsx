import { useState } from "react";

import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";
import { CraftGrid } from "@/features/crafts/components/CraftCard";
import { useUserCrafts } from "@/features/crafts/queries";

export function UserCrafts({ userId, heading }: { userId: number; heading: string }) {
  const [page, setPage] = useState(1);
  const crafts = useUserCrafts(userId, page);

  return (
    <section aria-labelledby="user-crafts-heading" className="mt-10">
      <h2 id="user-crafts-heading" className="text-xl font-semibold">
        {heading}
      </h2>
      {crafts.isPending ? (
        <PageLoader label="Loading crafts" />
      ) : crafts.isError ? (
        <p role="alert" className="mt-4 text-stone-700">
          Crafts could not be loaded.
        </p>
      ) : crafts.data.items.length === 0 ? (
        <p className="mt-4 text-stone-700">No crafts yet.</p>
      ) : (
        <div className="mt-4">
          <CraftGrid crafts={crafts.data.items} />
          <Pagination page={page} totalPages={crafts.data.totalPages} onChange={setPage} />
        </div>
      )}
    </section>
  );
}
