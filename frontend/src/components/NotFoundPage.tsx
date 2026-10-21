import { Link } from "react-router";

export function NotFoundPage({
  title = "Page not found",
  message = "The page you are looking for does not exist or is no longer available.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-20 text-center">
      <div aria-hidden="true" className="bg-contour animate-drift absolute inset-0 opacity-70" />
      <div className="relative mx-auto max-w-xl">
        <p className="font-display text-7xl font-semibold text-brand-200">404</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-stone-700">{message}</p>
        <Link to="/" className="btn-primary mt-8">
          Back to the map
        </Link>
      </div>
    </section>
  );
}
