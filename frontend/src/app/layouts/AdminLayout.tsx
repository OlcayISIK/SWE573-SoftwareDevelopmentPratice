import { NavLink, Outlet } from "react-router";

export function AdminLayout() {
  return (
    <div>
      <div className="border-b border-brand-100 bg-stone-900 text-white">
        <nav aria-label="Admin" className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
          <span className="text-sm font-semibold uppercase tracking-wide">Admin</span>
          <NavLink
            to="/admin/reports"
            className={({ isActive }) =>
              `rounded px-3 py-1 text-sm ${isActive ? "bg-white text-stone-900" : "hover:bg-stone-700"}`
            }
          >
            Review queue
          </NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
