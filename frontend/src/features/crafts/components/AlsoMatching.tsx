import { Languages } from "lucide-react";

import { useSearchTerms } from "../queries";

interface AlsoMatchingProps {
  search: string | undefined;
  exact: boolean;
  onExactChange: (exact: boolean) => void;
}

/**
 * Says which categories, craft types, tools, materials, and cultures a search also finds by
 * other names, such as Carpet for "halı", so people see why a craft is in the results, and lets
 * them search only the words as typed.
 */
export function AlsoMatching({ search, exact, onExactChange }: AlsoMatchingProps) {
  const terms = useSearchTerms(search, exact);
  if (!search) return null;

  if (exact) {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-stone-700">
        <Languages aria-hidden="true" className="h-4 w-4 text-stone-500" />
        Showing only crafts that contain “{search}”.
        <button
          type="button"
          className="font-medium text-brand-700 underline"
          onClick={() => onExactChange(false)}
        >
          Include other names and languages
        </button>
      </p>
    );
  }

  // An item found by two words of the search is listed once.
  const seen = new Set<string>();
  const related = (terms.data ?? [])
    .flatMap((term) => term.related)
    .filter((item) => {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (related.length === 0) return null;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-700">
      <Languages aria-hidden="true" className="h-4 w-4 text-stone-500" />
      <span>
        Also matching:{" "}
        {related.map((item, index) => (
          <span key={`${item.kind}:${item.id}`}>
            <strong className="font-semibold text-deep-sea">{item.name}</strong>
            {item.names.length > 0 && ` (${item.names.join(", ")})`}
            {index < related.length - 1 && ", "}
          </span>
        ))}
      </span>
      <button
        type="button"
        className="font-medium text-brand-700 underline"
        onClick={() => onExactChange(true)}
      >
        Search only “{search}”
      </button>
    </p>
  );
}
