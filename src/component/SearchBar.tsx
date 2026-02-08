"use client";

import { FormEvent } from "react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  examples?: string[];
};

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  examples = [],
}: SearchBarProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="group flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 shadow-sm backdrop-blur transition-colors focus-within:border-black/20 dark:border-white/10 dark:bg-white/5 dark:focus-within:border-white/20">
          <SearchIcon className="h-5 w-5 text-zinc-500 dark:text-zinc-300" />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='Search an item (e.g. "ps5")'
            className="w-full bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-white dark:placeholder:text-zinc-400"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
          >
            Search
          </button>
        </div>

        {examples.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => onChange(ex)}
                className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 21l-4.35-4.35" />
      <circle cx="11" cy="11" r="7" />
    </svg>
  );
}
