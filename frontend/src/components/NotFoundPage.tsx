import { Link } from "react-router";

export function NotFoundPage({
  title = "Page not found",
  message = "The page you are looking for does not exist or is no longer available.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-stone-700">{message}</p>
      <Link to="/" className="mt-6 inline-block font-medium text-brand-700 underline">
        Back to the map
      </Link>
    </section>
  );
}
