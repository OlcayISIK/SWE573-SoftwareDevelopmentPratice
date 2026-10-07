interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

const buttonClass =
  "rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-brand-100 disabled:opacity-50";

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
      <button
        type="button"
        className={buttonClass}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-sm text-stone-700" aria-current="page">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className={buttonClass}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
