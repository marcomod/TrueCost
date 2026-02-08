"use client";

import Link from "next/link";
import Image from "next/image";
import { PRODUCTS } from "@/lib/products.mock";

export default function SearchResults() {
  const featured = PRODUCTS.slice(0, 6);

  return (
    <section className="w-full">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Featured
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
            Try one click
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Mock catalog
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {featured.map((p) => (
          <Link
            key={p.id}
            href={`/item/${encodeURIComponent(p.name)}`}
            className="group rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
              <Image
                src={p.imageUrl}
                alt={p.name}
                width={512}
                height={512}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-3">
              <div className="line-clamp-1 text-sm font-semibold text-zinc-950 dark:text-white">
                {p.name}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {p.type} • ${p.defaultPrice.toFixed(2)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
