import type { ReactNode } from "react";
import { Link } from "react-router";

import { formatDimensions, formatWeight, type CraftAttributes } from "../../attributes";
import type { CraftDetail } from "../../types";
import { Swatch } from "../Swatch";

function ColorList({ colors }: { colors: CraftDetail["colors"] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2">
      {colors.map((color) => (
        <li key={color}>
          <Link
            to={`/crafts?color=${color.slice(1, 7)}`}
            className="flex items-center gap-2 hover:underline"
            title="Find crafts with a similar color"
          >
            <Swatch color={color} className="h-6 w-6" />
            <span className="font-mono text-sm text-stone-700">{color}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AttributeList({
  attributes,
  colors,
}: {
  attributes: CraftAttributes;
  colors: CraftDetail["colors"];
}) {
  const rows = (
    [
      ["Dimensions", formatDimensions(attributes.dimensions)],
      ["Weight", formatWeight(attributes.weight_g)],
      ["Colors", colors.length ? <ColorList colors={colors} /> : null],
      ["Distinguishing features", attributes.distinguishing_features || null],
    ] as [string, ReactNode][]
  ).filter(([, value]) => Boolean(value));

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
