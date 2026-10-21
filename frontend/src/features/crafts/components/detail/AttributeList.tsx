import type { ReactNode } from "react";

import { formatAmount, formatDimensions, type CraftAttributes } from "../../attributes";
import type { CraftDetail } from "../../types";
import { Swatch } from "../Swatch";

function ColorList({ colors }: { colors: CraftDetail["colors"] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <li
          key={color}
          className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm ring-1 ring-stone-200"
        >
          <Swatch color={color} className="h-7 w-7 rounded-full" />
          <span className="font-mono text-sm text-stone-700">{color}</span>
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
      ["Weight", formatAmount(attributes.dimensions, "weight")],
      ["Volume", formatAmount(attributes.dimensions, "volume")],
      ["Colors", colors.length ? <ColorList colors={colors} /> : null],
      ["Distinguishing features", attributes.distinguishing_features || null],
    ] as [string, ReactNode][]
  ).filter(([, value]) => Boolean(value));

  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="attributes-heading" className="mt-12">
      <h2 id="attributes-heading" className="text-2xl font-semibold">
        Characteristics
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${
              label === "Colors" || label === "Distinguishing features" ? "sm:col-span-2" : ""
            }`}
          >
            <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              {label}
            </dt>
            <dd className="mt-1.5 text-deep-sea">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
