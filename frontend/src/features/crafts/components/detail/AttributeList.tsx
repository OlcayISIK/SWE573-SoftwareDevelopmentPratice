import { formatDimensions, formatWeight, type CraftAttributes } from "../../attributes";

export function AttributeList({ attributes }: { attributes: CraftAttributes }) {
  const rows = [
    ["Dimensions", formatDimensions(attributes.dimensions)],
    ["Weight", formatWeight(attributes.weight_g)],
    ["Colors", attributes.colors?.length ? attributes.colors.join(", ") : null],
    ["Distinguishing features", attributes.distinguishing_features || null],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="attributes-heading" className="mt-10">
      <h2 id="attributes-heading" className="text-xl font-semibold">
        Characteristics
      </h2>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium text-stone-800">{label}</dt>
            <dd className="text-stone-700">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
