import { isRouteErrorResponse, useRouteError } from "react-router";

import { NotFoundPage } from "./NotFoundPage";

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <section role="alert" className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-stone-700">
        This page could not be displayed. Try again, or go back to the map.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          Try again
        </button>
        <a href="/" className="px-4 py-2 font-medium text-brand-700 underline">
          Back to the map
        </a>
      </div>
    </section>
  );
}
