"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useState } from "react";
import type { SVGProps } from "react";

type HeaderProps = {
  title?: string;
  homeHref?: string;
  navLinks?: Array<{ href: string; label: string }>;
};

export default function Header({
  title = "TrueCost",
  homeHref = "/",
  navLinks = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/insights", label: "Insights" },
    { href: "/user", label: "User" },
  ],
}: HeaderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const pathname = usePathname();

  const navId = `header-nav-${useId().replace(/:/g, "")}`;
  const normalizedPath = useMemo(() => {
    const p = pathname ?? "/";
    return p === "" ? "/" : p;
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/60 backdrop-blur dark:bg-black/30">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/20 md:hidden"
            aria-label="Open navigation menu"
            aria-controls={navId}
            aria-expanded={isNavOpen}
            onClick={() => setIsNavOpen((open) => !open)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <h1 className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-white">
              <LogoIcon className="h-5 w-5" />
            </span>
            <Link
              href={homeHref}
              className="text-base font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-950 to-zinc-500 dark:from-white dark:to-white/70"
            >
              {title}
            </Link>
          </h1>
        </div>

        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? normalizedPath === "/"
                : normalizedPath.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-black/5 text-zinc-950 dark:bg-white/10 dark:text-white"
                    : "text-zinc-700 hover:bg-black/5 hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/dashboard"
            className="hidden rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90 md:inline-flex"
          >
            Open Dashboard
          </Link>
          <Link
            href="/user"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/20"
            aria-label="User settings"
          >
            <UserIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <nav
        id={navId}
        className={[
          "border-t border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/40 md:hidden",
          isNavOpen ? "block" : "hidden",
        ].join(" ")}
        aria-label="Primary"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6">
          {navLinks.length > 0 ? (
            <ul className="flex list-none flex-row flex-wrap gap-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-full px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
                    onClick={() => setIsNavOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400">
              Add links via the <code className="font-mono">navLinks</code>{" "}
              prop.
            </p>
          )}
        </div>
      </nav>
    </header>
  );
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3v18" />
      <path d="M7 7h10" />
      <path d="M7 17h10" />
      <path d="M7 12h10" />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
    </svg>
  );
}
