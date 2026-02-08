"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const navItems: Array<{ label: string; href: string }> = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Insights", href: "/insights" },
];

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Backdrop */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/40 transition-opacity " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={
          "fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold tracking-wide text-slate-900">
            Menu
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="px-2 py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={
                  "block rounded-md px-3 py-2 text-sm transition-colors " +
                  (active
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-700 hover:bg-slate-50")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-slate-200 px-4 py-4 text-xs text-slate-500">
          TrueCost
        </div>
      </aside>
    </>
  );
}
