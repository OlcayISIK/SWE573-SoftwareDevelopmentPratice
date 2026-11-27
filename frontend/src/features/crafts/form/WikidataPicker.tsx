import { ExternalLink } from "lucide-react";
import { useEffect, useId, useMemo } from "react";

import { useDebouncedValue } from "@/lib/useDebouncedValue";

import { useWikidataSearch } from "../queries";
import { wikidataUrl } from "../wikidata";

interface WikidataPickerProps {
  /** The name to look up, such as the name of the item being added. */
  name: string;
  /** The chosen Wikidata item id, or "" for none. */
  value: string;
  onChange: (id: string) => void;
}

/**
 * Lets the person adding an item say which Wikidata item it is, so searches can find it by its
 * names in other languages. Several items can share a name ("Kilim" is also a family name), so
 * the person picks one from the matches, or none.
 */
export function WikidataPicker({ name, value, onChange }: WikidataPickerProps) {
  const id = useId();
  const query = useDebouncedValue(name.trim());
  const search = useWikidataSearch(query);
  const matches = useMemo(() => search.data ?? [], [search.data]);

  // A new name has new matches, so an earlier pick no longer applies.
  useEffect(() => {
    if (value && !matches.some((match) => match.id === value)) onChange("");
  }, [matches, value, onChange]);

  if (query.length < 2) return null;
  if (search.isError) {
    return (
      <p className="text-sm text-stone-600">
        Wikidata could not be reached, so it will be added without a link.
      </p>
    );
  }
  if (search.isPending) {
    return (
      <p className="text-sm text-stone-600" role="status">
        Looking up “{query}” on Wikidata…
      </p>
    );
  }
  if (matches.length === 0) return null;

  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="text-sm font-semibold text-deep-sea">Which one is it? (optional)</legend>
      <p id={`${id}-hint`} className="text-sm text-stone-600">
        Picking it on Wikidata lets people find it by its other names, such as its Turkish name.
      </p>
      <div className="mt-2 space-y-1.5">
        {matches.map((match) => (
          <label
            key={match.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-sm bg-white p-2 ring-1 ring-stone-200 has-[:checked]:ring-2 has-[:checked]:ring-brand-700"
          >
            <input
              type="radio"
              name={`${id}-wikidata`}
              className="mt-1"
              checked={value === match.id}
              onChange={() => onChange(match.id)}
            />
            <span className="min-w-0">
              <span className="font-medium text-deep-sea">{match.label}</span>
              {match.description && (
                <span className="block text-sm text-stone-600">{match.description}</span>
              )}
              <a
                href={wikidataUrl(match.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-700 underline"
              >
                {match.id} on Wikidata
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2.5 p-2">
          <input
            type="radio"
            name={`${id}-wikidata`}
            checked={value === ""}
            onChange={() => onChange("")}
          />
          <span className="text-sm">None of these</span>
        </label>
      </div>
    </fieldset>
  );
}
