"use client";

import Link from "next/link";
import Image from "next/image";
import { lookupProduct } from "@/lib/products.mock";
import { use, useEffect, useMemo, useState } from "react";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function resaleValueAfterTwoYears(purchasePrice: number) {
  // Hackathon-friendly depreciation:
  // Year 1: -35%, Year 2: -15% of remaining value
  const year1 = purchasePrice * (1 - 0.35);
  const year2 = year1 * (1 - 0.15);
  return { year1, year2 };
}

function investedValueAfterTwoYears(purchasePrice: number, annualRate = 0.08) {
  // Assume lump-sum investment, compounded annually (simple + explainable)
  const year1 = purchasePrice * (1 + annualRate);
  const year2 = purchasePrice * Math.pow(1 + annualRate, 2);
  return { year1, year2, annualRate };
}

function Sparkline({
  values,
  stroke,
}: {
  values: [number, number, number];
  stroke: string;
}) {
  const width = 220;
  const height = 56;
  const padX = 6;
  const padY = 6;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x =
        padX + (i * (width - padX * 2)) / Math.max(values.length - 1, 1);
      const y =
        padY + (1 - (v - min) / range) * (height - padY * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ItemPage({
  params,
}: {
  params: Promise<{ query: string }>;
}) {
  // Next.js 16 can pass params as a Promise (sync dynamic APIs).
  const { query } = use(params);

  const decoded = useMemo(() => {
    try {
      return decodeURIComponent(query);
    } catch {
      return query;
    }
  }, [query]);

  return <ItemPageInner key={decoded} decoded={decoded} />;
}

function ItemPageInner({ decoded }: { decoded: string }) {
  const info = useMemo(() => lookupProduct(decoded), [decoded]);
  const [liveImage, setLiveImage] = useState<{ q: string; url: string } | null>(
    null,
  );

  useEffect(() => {
    const q = decoded.trim();
    if (!q) return;

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/image?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { imageUrl?: string | null };
        if (typeof data.imageUrl === "string" && data.imageUrl) {
          setLiveImage({ q: decoded, url: data.imageUrl });
        } else {
          setLiveImage(null);
        }
      } catch {
        setLiveImage(null);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [decoded]);

  const imageUrl =
    (liveImage?.q === decoded ? liveImage.url : null) ?? info.imageUrl;

  const [priceMode, setPriceMode] = useState<"auto" | "manual">(
    info.defaultPrice == null ? "manual" : "auto",
  );
  const [manualPrice, setManualPrice] = useState<string>("");

  const effectivePrice =
    priceMode === "auto"
      ? info.defaultPrice
      : Number.isFinite(Number(manualPrice)) && Number(manualPrice) > 0
        ? Number(manualPrice)
        : null;

  return (
    <main className="px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </Link>

          <div className="hidden items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:flex">
            <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              Demo catalog
            </span>
            <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              Split comparison
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
              <Image
                src={imageUrl}
                alt={info.displayName}
                width={1000}
                height={1000}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                {info.type}
              </span>
              <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                Search: {decoded}
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Item
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {info.displayName}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Pick a price, then compare depreciation vs growth over 2 years.
              </p>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {priceMode === "auto" ? "Auto price" : "Manual price"}
                  </div>
                  <div className="text-2xl font-semibold text-zinc-950 dark:text-white tabular-nums">
                    {effectivePrice == null ? "—" : formatMoney(effectivePrice)}
                  </div>
                  {priceMode === "auto" && info.defaultPrice == null && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      No catalog match. Switch to manual price.
                    </div>
                  )}
                </div>

                <div className="inline-flex items-center rounded-xl border border-black/10 bg-white/60 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setPriceMode("auto")}
                    className={
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                      (priceMode === "auto"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                        : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                    }
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode("manual")}
                    className={
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                      (priceMode === "manual"
                        ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                        : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                    }
                  >
                    Manual
                  </button>
                </div>
              </div>

              {priceMode === "manual" && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    Enter price
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-400 dark:focus:border-white/20"
                    placeholder="e.g. 499.99"
                  />
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-2xl bg-zinc-950/40 px-4 py-3 text-sm font-semibold text-white transition dark:bg-white/20"
                  title="Next step: save to Ghost Cart"
                >
                  Add to Ghost Cart
                </button>
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Next: Ghost Cart persistence + history.
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
              2-year split comparison
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Estimates (demo math)
            </div>
          </div>

          {effectivePrice == null ? (
            <div className="mt-3 rounded-2xl bg-black/5 p-4 text-sm text-zinc-700 dark:bg-white/5 dark:text-zinc-200">
              Pick a price first (Auto or Manual) to see the comparison.
            </div>
          ) : (
            (() => {
              const resale = resaleValueAfterTwoYears(effectivePrice);
              const invest = investedValueAfterTwoYears(effectivePrice, 0.08);
              const delta = invest.year2 - resale.year2;

              return (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Left → Purchase asset
                        </div>
                        <div className="mt-1 text-base font-semibold text-zinc-950 dark:text-white">
                          Depreciates
                        </div>
                      </div>
                      <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                        Resale value
                      </div>
                    </div>

                    <div className="mt-3">
                      <Sparkline
                        values={[effectivePrice, resale.year1, resale.year2]}
                        stroke="#e11d48"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Today
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(effectivePrice)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          1 year
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(resale.year1)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          2 years
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(resale.year2)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Model: -35% year 1, then -15% year 2.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Right → Investment asset
                        </div>
                        <div className="mt-1 text-base font-semibold text-zinc-950 dark:text-white">
                          Grows
                        </div>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        Portfolio value
                      </div>
                    </div>

                    <div className="mt-3">
                      <Sparkline
                        values={[effectivePrice, invest.year1, invest.year2]}
                        stroke="#059669"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Today
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(effectivePrice)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          1 year
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(invest.year1)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          2 years
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(invest.year2)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Assumes ~{Math.round(invest.annualRate * 100)}%/yr return.
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                    <div className="text-sm font-medium text-zinc-950 dark:text-white">
                      Opportunity cost (2 years)
                    </div>
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                      If you invest instead of buy, you could be up about{" "}
                      <span className="font-semibold text-zinc-950 dark:text-white">
                        {formatMoney(Math.max(delta, 0))}
                      </span>{" "}
                      after 2 years (investment value minus estimated resale).
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </section>
      </div>
    </main>
  );
}

function ArrowLeftIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
