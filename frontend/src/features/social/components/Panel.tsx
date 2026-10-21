import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `panel-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className="animate-fade-up rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
