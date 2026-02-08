"use client";

import Link from "next/link";
import { useId, useState } from "react";
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
  ],
}: HeaderProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const navId = `header-nav-${useId().replace(/:/g, "")}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <div className="mx-auto grid h-14 w-full max-w-5xl grid-cols-3 items-center px-4 sm:px-6">
        <div className="flex items-center">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/20"
            aria-label="Open navigation menu"
            aria-controls={navId}
            aria-expanded={isNavOpen}
            onClick={() => setIsNavOpen((open) => !open)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>

        <h1 className="justify-self-center">
          <Link
            href={homeHref}
            className="text-lg font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-950 to-zinc-500 dark:from-zinc-50 dark:to-zinc-400"
          >
            {title}
          </Link>
        </h1>

        <div className="flex items-center justify-end">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/5 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/20"
            aria-label="User account"
          >
            <UserIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav
        id={navId}
        className={[
          "border-t border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-black/70",
          isNavOpen ? "block" : "hidden",
        ].join(" ")}
        aria-label="Primary"
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6">
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
