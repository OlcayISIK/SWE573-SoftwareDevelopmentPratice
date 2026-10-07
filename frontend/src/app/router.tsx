import type { RouteObject } from "react-router";

import { NotFoundPage } from "@/components/NotFoundPage";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RequireAuth } from "@/features/auth/components/RouteGuards";

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
          {
            path: "crafts",
            lazy: () =>
              import("@/features/crafts/pages/CraftListPage").then((m) => ({
                Component: m.CraftListPage,
              })),
          },
          {
            path: "crafts/:id",
            lazy: () =>
              import("@/features/crafts/pages/CraftDetailPage").then((m) => ({
                Component: m.CraftDetailPage,
              })),
          },
          {
            path: "users/:id",
            lazy: () =>
              import("@/features/profiles/pages/PublicProfilePage").then((m) => ({
                Component: m.PublicProfilePage,
              })),
          },
          {
            element: <RequireAuth />,
            children: [
              {
                path: "me",
                lazy: () =>
                  import("@/features/profiles/pages/MyProfilePage").then((m) => ({
                    Component: m.MyProfilePage,
                  })),
              },
              {
                path: "me/favorites",
                lazy: () =>
                  import("@/features/social/pages/MyFavoritesPage").then((m) => ({
                    Component: m.MyFavoritesPage,
                  })),
              },
              {
                path: "me/settings",
                lazy: () =>
                  import("@/features/profiles/pages/SettingsPage").then((m) => ({
                    Component: m.SettingsPage,
                  })),
              },
              {
                path: "crafts/new",
                lazy: () =>
                  import("@/features/crafts/pages/NewCraftPage").then((m) => ({
                    Component: m.NewCraftPage,
                  })),
              },
              {
                path: "crafts/:id/edit",
                lazy: () =>
                  import("@/features/crafts/pages/EditCraftPage").then((m) => ({
                    Component: m.EditCraftPage,
                  })),
              },
            ],
          },
          {
            path: "login",
            lazy: () =>
              import("@/features/auth/pages/LoginPage").then((m) => ({ Component: m.LoginPage })),
          },
          {
            path: "register",
            lazy: () =>
              import("@/features/auth/pages/RegisterPage").then((m) => ({
                Component: m.RegisterPage,
              })),
          },
          {
            path: "verify-email",
            lazy: () =>
              import("@/features/auth/pages/VerifyEmailPage").then((m) => ({
                Component: m.VerifyEmailPage,
              })),
          },
          {
            path: "password-reset",
            lazy: () =>
              import("@/features/auth/pages/PasswordResetPage").then((m) => ({
                Component: m.PasswordResetPage,
              })),
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
