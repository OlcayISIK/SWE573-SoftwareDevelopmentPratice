import type { ReactNode } from "react";

/** A friendly message on the contour pattern, for lists with nothing to show. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="animate-fade-up relative overflow-hidden rounded-xl border border-dashed border-brand-200 bg-white px-6 py-12 text-center">
      <div aria-hidden="true" className="bg-contour absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-md">
        <p className="font-display text-xl font-semibold text-deep-sea">{title}</p>
        {children && <div className="mt-2 text-stone-600">{children}</div>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
