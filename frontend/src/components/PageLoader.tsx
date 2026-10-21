export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center p-10">
      <span
        aria-hidden="true"
        className="h-9 w-9 animate-spin rounded-full border-4 border-sky-wash border-t-brand-700"
      />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
