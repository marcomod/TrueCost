"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "ps5",
  "airpods pro",
  "keurig coffee maker",
  "nike dunks",
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/item/${encodeURIComponent(q)}`);
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            TrueCost
          </h1>
          <p className="text-sm text-slate-600">
            Type what you want to buy. See the real cost over time.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "ps5"'
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>
      </div>
    </main>
  );
}
