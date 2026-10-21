import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";

import { CraftGrid, CraftGridSkeleton } from "../components/CraftCard";
import { FilterBar } from "../components/FilterBar";
import { noMatchMessage, useCraftFilters } from "../hooks/useCraftFilters";
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
        heading={
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lagoon">
                Browse the collection
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-deep-sea sm:text-4xl">Crafts</h1>
            </div>
            {crafts.data && crafts.data.items.length > 0 && (
              <p className="text-sm font-medium text-stone-600">
                {crafts.data.total} {crafts.data.total === 1 ? "craft" : "crafts"}
              </p>
            )}
          </div>
        }
      />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy={crafts.isFetching}>
        {crafts.isPending ? (
          <div role="status">
            <span className="sr-only">Loading crafts…</span>
            <CraftGridSkeleton />
          </div>
        ) : crafts.isError ? (
          <p role="alert" className="text-stone-700">
            Crafts could not be loaded.
          </p>
        ) : crafts.data.items.length === 0 ? (
          <EmptyState
            title={hasFilters ? noMatchMessage(filters) : "No crafts have been added yet."}
            action={
              hasFilters && (
                <button type="button" className="btn-primary" onClick={clearFilters}>
                  Clear filters
                </button>
              )
            }
          >
            {hasFilters
              ? "Try another word, or fewer filters."
              : "Be the first to share a craft from your community."}
          </EmptyState>
        ) : (
          <>
            <CraftGrid crafts={crafts.data.items} />
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
