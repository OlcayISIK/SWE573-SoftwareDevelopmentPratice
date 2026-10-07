export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center p-10">
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
      />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
