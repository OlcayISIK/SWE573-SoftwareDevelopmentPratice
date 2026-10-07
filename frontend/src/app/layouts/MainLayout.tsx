import { Link, NavLink, Outlet, useNavigation } from "react-router";

import { PageLoader } from "@/components/PageLoader";
import { AccountMenu } from "@/features/auth/components/AccountMenu";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-2 text-sm font-medium ${
    isActive ? "bg-brand-100 text-brand-900" : "text-stone-700 hover:bg-brand-100"
  }`;

export function MainLayout() {
  const navigation = useNavigation();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>
      <header className="border-b border-brand-100 bg-white">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3"
        >
          <Link to="/" className="mr-4 text-lg font-semibold text-brand-700">
            Indigenous Crafts
          </Link>
          <NavLink to="/" end className={navLinkClass}>
            Map
          </NavLink>
          <NavLink to="/crafts" className={navLinkClass}>
            Crafts
          </NavLink>
          <div className="ml-auto flex items-center gap-2">
            <AccountMenu />
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        {navigation.state === "loading" ? <PageLoader /> : <Outlet />}
      </main>
      <footer className="border-t border-brand-100 bg-white px-4 py-4 text-center text-sm text-stone-600">
        Indigenous Crafts, SWE573 course project. Map data © OpenStreetMap contributors.
      </footer>
    </div>
  );
}
