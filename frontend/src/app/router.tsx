import type { RouteObject } from "react-router";

import { NotFoundPage } from "@/components/NotFoundPage";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

import { MainLayout } from "./layouts/MainLayout";

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        errorElement: <RouteErrorBoundary />,
        children: [
          {
            index: true,
            lazy: () =>
              import("@/features/crafts/pages/MapPage").then((m) => ({ Component: m.MapPage })),
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
