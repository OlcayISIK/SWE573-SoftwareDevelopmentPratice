import type { ReactNode } from "react";
import { Link } from "react-router";

import { Tooltip } from "@/components/Tooltip";
import { ReportItemButton } from "@/features/moderation/components/ReportDialog";

import { placeName } from "../../place";
import type { CraftDetail, NamedItem } from "../../types";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-stone-600">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function ItemList({ kind, items }: { kind: "tool" | "material"; items: NamedItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <Tooltip text={item.description}>
            {(describedBy) => (
              // Crafts that use the item are found by searching for its name.
              <Link
                to={`/crafts?search=${encodeURIComponent(item.name)}`}
                className="underline"
                aria-describedby={describedBy}
              >
                {item.name}
              </Link>
            )}
          </Tooltip>
          <ReportItemButton kind={kind} item={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The craft's lookup items and place. Each links to the crafts that share it, and items that
 * users added can be reported from here.
 */
export function CraftFacts({ craft }: { craft: CraftDetail }) {
  const { category, craft_type: craftType, culture, tools, materials } = craft;
  const places = craft.places.filter((place) => placeName(place));

  return (
    <section
      aria-labelledby="facts-heading"
      className="rounded-lg border border-brand-100 bg-white p-5"
    >
      <h2 id="facts-heading" className="text-lg font-semibold">
        Craft facts
      </h2>
      <dl className="mt-3 space-y-3">
        <Fact label="Category">
          <Tooltip text={category.description}>
            {(describedBy) => (
              <Link
                to={`/crafts?category=${category.slug}`}
                className="underline"
                aria-describedby={describedBy}
              >
                {category.name}
              </Link>
            )}
          </Tooltip>
          <ReportItemButton kind="category" item={category} />
        </Fact>
        <Fact label="Craft type">
          <Tooltip text={craftType.description}>
            {(describedBy) => (
              <Link
                to={`/crafts?category=${category.slug}&craft_type=${craftType.id}`}
                className="underline"
                aria-describedby={describedBy}
              >
                {craftType.name}
              </Link>
            )}
          </Tooltip>
          <ReportItemButton kind="craft_type" item={craftType} />
        </Fact>
        {culture && (
          <Fact label="Culture">
            <Tooltip text={culture.description}>
              {(describedBy) => (
                <Link
                  to={`/crafts?culture=${culture.id}`}
                  className="underline"
                  aria-describedby={describedBy}
                >
                  {culture.name}
                </Link>
              )}
            </Tooltip>
            <ReportItemButton kind="culture" item={culture} />
            {culture.homeland && (
              <span className="block text-sm text-stone-600">{culture.homeland}</span>
            )}
          </Fact>
        )}
        {tools.length > 0 && (
          <Fact label="Tools">
            <ItemList kind="tool" items={tools} />
          </Fact>
        )}
        {materials.length > 0 && (
          <Fact label="Materials">
            <ItemList kind="material" items={materials} />
          </Fact>
        )}
        {places.length > 0 && (
          <Fact label={places.length > 1 ? "Places" : "Place"}>
            <ul className="space-y-0.5">
              {places.map((place) => (
                <li key={place.id}>
                  {place.city}
                  {place.city && place.country && ", "}
                  {place.country ? (
                    <Link
                      to={`/crafts?country=${encodeURIComponent(place.country)}`}
                      className="underline"
                    >
                      {place.country}
                    </Link>
                  ) : null}
                  {place.is_origin && <span className="ml-1 text-sm text-stone-600">(origin)</span>}
                </li>
              ))}
            </ul>
          </Fact>
        )}
      </dl>
    </section>
  );
}
