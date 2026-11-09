import { NavLink, Outlet } from "react-router";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-white text-deep-sea shadow-sm"
      : "text-stone-200 hover:bg-white/10 hover:text-white"
  }`;

export function AdminLayout() {
  return (
    <div>
      <div className="bg-deep-sea text-white">
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6"
        >
          <span className="mr-2 rounded-full bg-amber px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-deep-sea">
            Admin
          </span>
          <NavLink to="/admin/reports" className={linkClass}>
            Reported crafts
          </NavLink>
          <NavLink to="/admin/item-reports" className={linkClass}>
            Reported items
          </NavLink>
          <NavLink to="/admin/story-reports" className={linkClass}>
            Reported stories
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
