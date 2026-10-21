import { Menu, Plus, X } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigation } from "react-router";

import { LogoMark } from "@/components/LogoMark";
import { PageLoader } from "@/components/PageLoader";
import { AccountMenu } from "@/features/auth/components/AccountMenu";

function NavItem({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative rounded-sm px-3 py-2 text-sm font-medium ${
          isActive ? "text-brand-900" : "text-stone-700 hover:bg-sky-wash/70 hover:text-brand-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            // The underline slides to the active page.
            <motion.span
              layoutId="nav-underline"
              className="absolute inset-x-3 -bottom-[13px] h-[3px] rounded-full bg-brand-700"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export function MainLayout() {
  const navigation = useNavigation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // A new page closes the mobile menu.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[2000] focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>
      {/* Above the map's panes, which Leaflet places up to z-index 1000. */}
      <header
        className={`sticky top-0 z-[1050] transition-shadow duration-200 ${
          scrolled ? "bg-white/85 shadow-md backdrop-blur-md" : "bg-white"
        }`}
      >
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:px-6"
        >
          <Link to="/" className="group mr-4 flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 transition-transform duration-300 group-hover:rotate-12" />
            <span className="font-display text-xl font-semibold tracking-tight text-deep-sea">
              Indigenous Crafts
            </span>
          </Link>
          <LayoutGroup>
            <div className="hidden items-center gap-1 md:flex">
              <NavItem to="/" end>
                Map
              </NavItem>
              <NavItem to="/crafts">Crafts</NavItem>
            </div>
          </LayoutGroup>
          <div className="ml-auto hidden items-center gap-1 md:flex">
            <NavLink to="/crafts/new" className="btn-primary mr-1">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add a craft
            </NavLink>
            <AccountMenu />
          </div>
          <button
            type="button"
            className="btn-ghost ml-auto px-2.5 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        <div className="woven-band" />
        {menuOpen && (
          <div
            id="mobile-menu"
            className="animate-fade-up absolute inset-x-0 top-full z-[1050] border-b border-stone-200 bg-white px-4 pb-5 pt-3 shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1 [&>a]:justify-start [&>button]:justify-start">
              <NavLink to="/" end className="btn-ghost justify-start">
                Map
              </NavLink>
              <NavLink to="/crafts" className="btn-ghost justify-start">
                Crafts
              </NavLink>
              <AccountMenu />
              <NavLink to="/crafts/new" className="btn-primary mt-2">
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add a craft
              </NavLink>
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1">
        {navigation.state === "loading" ? (
          <PageLoader />
        ) : (
          <div key={location.pathname} className="animate-fade-up">
            <Outlet />
          </div>
        )}
      </main>
      <footer className="mt-12 bg-deep-sea text-stone-300">
        <div className="woven-band opacity-90" />
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm sm:flex-row">
          <div className="flex items-center gap-3">
            <LogoMark className="h-8 w-8" />
            <div>
              <p className="font-display text-base font-semibold text-white">Indigenous Crafts</p>
              <p className="text-stone-400">Crafts made by hand, around the world.</p>
            </div>
          </div>
          <p className="text-center text-stone-300 sm:text-right">
            SWE573 course project. Map data © OpenStreetMap contributors.
          </p>
        </div>
      </footer>
    </div>
  );
}
