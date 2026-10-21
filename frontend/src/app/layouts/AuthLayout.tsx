import { Heart, MapPin, ShieldCheck } from "lucide-react";
import { Outlet } from "react-router";

import { LogoMark } from "@/components/LogoMark";

const POINTS = [
  { icon: MapPin, text: "Pin crafts on the world map, with the places they come from." },
  { icon: Heart, text: "Save the crafts you love and follow the people who share them." },
  { icon: ShieldCheck, text: "A community that keeps every story accurate and respectful." },
];

/** Log in, register, and password pages: the form beside a panel about the site. */
export function AuthLayout() {
  return (
    <div className="mx-auto grid max-w-6xl px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="relative hidden min-h-[36rem] flex-col justify-between gap-10 overflow-hidden rounded-l-2xl bg-deep-sea p-10 text-white lg:flex">
        <div aria-hidden="true" className="bg-contour animate-drift absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <span className="font-display text-xl font-semibold">Indigenous Crafts</span>
        </div>
        <div className="relative">
          <p className="font-display text-4xl font-semibold leading-tight">
            Every craft has a place, a people, and a story.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-stone-200">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon aria-hidden="true" className="h-4 w-4 text-amber" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden="true" className="woven-band relative -mx-10 -mb-10 mt-10" />
      </div>
      <div className="flex items-center rounded-2xl bg-white shadow-lg ring-1 ring-stone-200 lg:rounded-l-none">
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
