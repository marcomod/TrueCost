"use client";

import Link from "next/link";
import { lookupProduct } from "@/lib/products.mock";
import { useMemo, useState } from "react";

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

export default function ItemPage({ params }: { params: { query: string } }) {
  const decoded = useMemo(() => {
    try {
      return decodeURIComponent(params.query);
    } catch {
      return params.query;
    }
  }, [params.query]);

  const info = useMemo(() => lookupProduct(decoded), [decoded]);

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
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            ← Back
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-slate-50">
              <img
                src={info.imageUrl}
                alt={info.displayName}
                className="h-full w-full object-contain"
                loading="eager"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Item</div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {info.displayName}
              </h1>
              <div className="text-sm text-slate-600">
                Type: <span className="font-medium">{info.type}</span>
              </div>
              <div className="text-sm text-slate-600">
                Search: <span className="font-medium">{decoded}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs text-slate-500">
                    {priceMode === "auto" ? "Auto price" : "Manual price"}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {effectivePrice == null ? "—" : `$${effectivePrice.toFixed(2)}`}
                  </div>
                  {priceMode === "auto" && info.defaultPrice == null && (
                    <div className="mt-1 text-xs text-slate-500">
                      No catalog match. Switch to manual price.
                    </div>
                  )}
                </div>

                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPriceMode("auto")}
                    className={
                      "rounded-lg px-3 py-2 text-sm font-medium " +
                      (priceMode === "auto"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceMode("manual")}
                    className={
                      "rounded-lg px-3 py-2 text-sm font-medium " +
                      (priceMode === "manual"
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    Manual
                  </button>
                </div>
              </div>

              {priceMode === "manual" && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Enter price
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
                    placeholder="e.g. 499.99"
                  />
                </div>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl bg-slate-300 px-4 py-3 text-sm font-semibold text-white"
                  title="Next step: save to Ghost Cart"
                >
                  Add to Ghost Cart
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  2-year split comparison
                </div>
                <div className="text-xs text-slate-500">
                  Estimates (demo math)
                </div>
              </div>

              {effectivePrice == null ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  Pick a price first (Auto or Manual) to see the comparison.
                </div>
              ) : (
                (() => {
                  const resale = resaleValueAfterTwoYears(effectivePrice);
                  const invest = investedValueAfterTwoYears(effectivePrice, 0.08);
                  const delta = invest.year2 - resale.year2;

                  return (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500">
                              Left → Purchase asset
                            </div>
                            <div className="mt-1 text-base font-semibold text-slate-900">
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
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Today</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(effectivePrice)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">1 year</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(resale.year1)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">2 years</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(resale.year2)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Model: -35% year 1, then -15% year 2.
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500">
                              Right → Investment asset
                            </div>
                            <div className="mt-1 text-base font-semibold text-slate-900">
                              Grows
                            </div>
                          </div>
                          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            Portfolio value
                          </div>
                        </div>

                        <div className="mt-3">
                          <Sparkline
                            values={[
                              effectivePrice,
                              invest.year1,
                              invest.year2,
                            ]}
                            stroke="#059669"
                          />
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">Today</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(effectivePrice)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">1 year</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(invest.year1)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <div className="text-xs text-slate-500">2 years</div>
                            <div className="font-semibold text-slate-900">
                              {formatMoney(invest.year2)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          Assumes ~{Math.round(invest.annualRate * 100)}%/yr
                          return.
                        </div>
                      </div>

                      <div className="md:col-span-2 rounded-2xl bg-slate-50 p-4">
                        <div className="text-sm font-medium text-slate-900">
                          Opportunity cost (2 years)
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          If you invest instead of buy, you could be up about{" "}
                          <span className="font-semibold text-slate-900">
                            {formatMoney(Math.max(delta, 0))}
                          </span>{" "}
                          after 2 years (investment value minus estimated resale).
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
