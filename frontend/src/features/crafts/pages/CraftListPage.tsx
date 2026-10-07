import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";

import { CraftGrid } from "../components/CraftCard";
import { FilterBar } from "../components/FilterBar";
import { useCraftFilters } from "../hooks/useCraftFilters";
import { useCraftList } from "../queries";

export function CraftListPage() {
  const { filters, setFilters, clearFilters, hasFilters } = useCraftFilters();
  const crafts = useCraftList(filters);

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />
      <section className="mx-auto max-w-6xl px-4 py-8" aria-busy={crafts.isFetching}>
        <h1 className="text-2xl font-semibold">Crafts</h1>
        {crafts.isPending ? (
          <PageLoader label="Loading crafts" />
        ) : crafts.isError ? (
          <p role="alert" className="mt-6 text-stone-700">
            Crafts could not be loaded.
          </p>
        ) : crafts.data.items.length === 0 ? (
          <div className="mt-6 text-stone-700">
            <p>{hasFilters ? "No crafts match your filters." : "No crafts have been added yet."}</p>
            {hasFilters && (
              <button
                type="button"
                className="mt-2 font-medium text-brand-700 underline"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-600">
              {crafts.data.total} {crafts.data.total === 1 ? "craft" : "crafts"}
            </p>
            <div className="mt-6">
              <CraftGrid crafts={crafts.data.items} />
            </div>
            <Pagination
              page={crafts.data.page}
              totalPages={crafts.data.totalPages}
              onChange={(page) => setFilters({ page })}
            />
          </>
        )}
      </section>
    </>
  );
}
