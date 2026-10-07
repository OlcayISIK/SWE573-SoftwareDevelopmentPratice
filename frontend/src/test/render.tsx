import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";

import { AppProviders } from "@/app/providers";
import { routes as appRoutes } from "@/app/router";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

export function renderRoute(
  path: string,
  {
    routes = appRoutes,
    client = createTestQueryClient(),
  }: { routes?: RouteObject[]; client?: QueryClient } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <AppProviders client={client}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, client };
}
