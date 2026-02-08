"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SearchBar from "@/component/SearchBar";
import SearchResults from "@/component/SearchResults";

const EXAMPLES = ["ps5", "airpods pro", "keurig coffee maker", "nike dunks"];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit() {
    const q = query.trim();
    if (!q) return;
    router.push(`/item/${encodeURIComponent(q)}`);
  }

  return (
    <main className="px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Personal finance, re-framed
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl">
            See the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500">
              true cost
            </span>{" "}
            of what you buy.
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-300">
            Search an item, pick a price, and compare “buying it” vs investing
            instead.
          </p>

          <div className="mt-8">
            <SearchBar
              value={query}
              onChange={setQuery}
              onSubmit={onSubmit}
              examples={EXAMPLES}
            />
          </div>
        </div>

        <div className="mt-10">
          <SearchResults />
        </div>
      </div>
    </main>
  );
}
