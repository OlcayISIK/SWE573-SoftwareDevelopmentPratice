import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CraftFormValues } from "./schema";

type Values = CraftFormValues;

interface Section {
  id: string;
  label: string;
  /** Required sections show a check once filled in; optional ones once anything is added. */
  required: boolean;
  done: (values: Values) => boolean;
}

const SECTIONS: Section[] = [
  {
    id: "section-basics",
    label: "Basics",
    required: true,
    done: (v) => Boolean(v.name.trim() && v.category && v.craft_type && v.culture),
  },
  {
    id: "section-places",
    label: "Places",
    required: true,
    done: (v) => v.places.every((place) => place.address.trim() && place.latitude),
  },
  {
    id: "section-tools",
    label: "Tools and materials",
    required: false,
    done: (v) => v.tools.length + v.materials.length > 0,
  },
  {
    id: "section-description",
    label: "Description and story",
    required: true,
    done: (v) => Boolean(v.description.trim()),
  },
  {
    id: "section-characteristics",
    label: "Characteristics",
    required: false,
    done: (v) =>
      v.attributes.dimensions.length + v.colors.length > 0 ||
      Boolean(v.attributes.distinguishing_features.trim()),
  },
];

const MEDIA: Section = { id: "section-media", label: "Media", required: false, done: () => false };

/** Which section is on screen: the last one whose top has passed the upper third. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight / 3;
      let current = ids[0];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [ids]);
  return active;
}

/** The form's sections beside it: where you are, what is done, and a jump to each. */
export function FormProgress({
  form,
  withMedia = false,
}: {
  form: UseFormReturn<CraftFormValues>;
  withMedia?: boolean;
}) {
  const values = form.watch();
  const sections = withMedia ? [...SECTIONS, MEDIA] : SECTIONS;
  const active = useActiveSection(sections.map((section) => section.id));
  const required = SECTIONS.filter((section) => section.required);
  const finished = required.filter((section) => section.done(values)).length;

  return (
    <nav
      aria-label="Form sections"
      className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        {finished} of {required.length} required parts done
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-lagoon transition-all duration-500"
          style={{ width: `${(finished / required.length) * 100}%` }}
        />
      </div>
      <ol className="mt-4 space-y-1">
        {sections.map((section, index) => {
          const done = section.done(values);
          const isActive = active === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-3 rounded-sm px-2 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-sky-wash text-brand-900" : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? "bg-lagoon text-white"
                      : isActive
                        ? "bg-brand-700 text-white"
                        : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="flex-1">{section.label}</span>
                {!section.required && <span className="text-xs text-stone-500">Optional</span>}
                {done && <span className="sr-only">(done)</span>}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
