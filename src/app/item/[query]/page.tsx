"use client";

import Link from "next/link";
import Image from "next/image";
import { lookupProduct } from "@/lib/products.mock";
import { addGhostCartItem, getMyProfile } from "@/app/actions";
import { use, useEffect, useMemo, useState } from "react";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatWorkTime(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return "—";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
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
  const [settings, setSettings] = useState<{
    currency: string;
    expectedAnnualReturn: number;
    hourlyWage: number;
    jobSatisfaction: number;
  } | null>(null);
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostToast, setGhostToast] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const p = await getMyProfile();
      setSettings({
        currency: p.settings.currency,
        expectedAnnualReturn: p.settings.expectedAnnualReturn,
        hourlyWage: p.settings.hourlyWage,
        jobSatisfaction: p.settings.jobSatisfaction,
      });
    })();
  }, []);

  const currency = settings?.currency ?? "CAD";
  const expectedAnnualReturn = settings?.expectedAnnualReturn ?? 0.08;
  const hourlyWage = settings?.hourlyWage ?? 0;
  const jobSatisfaction = settings?.jobSatisfaction ?? 7;
  const stressMultiplier = 1 + (10 - Math.max(1, Math.min(10, jobSatisfaction))) * 0.1;
  const [forcePlaceholder, setForcePlaceholder] = useState(false);
  const imgSrc = forcePlaceholder ? "/placeholder.svg" : info.imageUrl;

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

  const workTimeHours =
    effectivePrice != null && hourlyWage > 0
      ? (effectivePrice / hourlyWage) * stressMultiplier
      : NaN;

  const freedomDays =
    effectivePrice != null && hourlyWage > 0
      ? effectivePrice / (hourlyWage * 8)
      : NaN;

  const lifeCost = useMemo(() => {
    if (effectivePrice == null) return null;
    const price = effectivePrice;

    // Hackathon-friendly defaults (kept intentionally simple).
    const weeklyGroceries = currency === "CAD" ? 160 : 120;
    const nycFlight = currency === "CAD" ? 450 : 350;
    const monthlyRent = currency === "CAD" ? 1700 : 1400;

    return {
      groceriesWeeks: price / weeklyGroceries,
      flights: price / nycFlight,
      rentMonths: price / monthlyRent,
    };
  }, [effectivePrice, currency]);

  async function onGhostIt() {
    if (ghostBusy) return;
    if (effectivePrice == null) return;

    try {
      setGhostBusy(true);
      const result = await addGhostCartItem({
        title: info.displayName,
        price: effectivePrice,
        category: info.type,
        imageUrl: info.imageUrl,
        priceMode,
      });

      if (!result.ok) {
        setGhostToast({
          title: "Couldn’t Ghost It",
          subtitle: result.error,
        });
        return;
      }

      setGhostToast({
        title: "Ghosted",
        subtitle: `You just saved ${formatWorkTime(workTimeHours)} of your life.`,
      });

      window.setTimeout(() => setGhostToast(null), 2600);
    } finally {
      setGhostBusy(false);
    }
  }

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

          <div />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
              <Image
                src={imgSrc}
                alt={info.displayName}
                width={1000}
                height={1000}
                priority
                unoptimized
                className="h-full w-full object-contain"
                onError={() => setForcePlaceholder(true)}
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
                  {effectivePrice == null
                    ? "—"
                    : formatMoney(effectivePrice, currency)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Work time: {formatWorkTime(workTimeHours)}
                  {stressMultiplier !== 1 ? ` (×${stressMultiplier.toFixed(1)} stress)` : ""}
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
                  onClick={onGhostIt}
                  disabled={ghostBusy || effectivePrice == null}
                  className="w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-900 disabled:bg-zinc-950/40 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90 dark:disabled:bg-white/20"
                  title="Save this decision to your Ghost Cart"
                >
                  {ghostBusy ? "Ghosting…" : "Ghost It"}
                </button>
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Ghost it instead of buying — we’ll track the simulated market
                  growth.
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Life-cost breakdown
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                      Or this…
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    Freedom gain: {formatDays(freedomDays)}
                  </div>
                </div>

                {lifeCost == null ? (
                  <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Pick a price to see the “Or this…” comparisons.
                  </div>
                ) : (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>🛒 Groceries</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          ~{lifeCost.groceriesWeeks.toFixed(1)} weeks
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          of food
                        </div>
                      </div>

                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>✈️ Travel</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          ~{lifeCost.flights.toFixed(1)} flights
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          to NYC
                        </div>
                      </div>

                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>🛡️ Security</span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          ~{lifeCost.rentMonths.toFixed(1)} months
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          rent buffer
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                      Ghosting this moves your “Freedom Day”{" "}
                      <span className="font-semibold text-zinc-950 dark:text-white">
                        {formatDays(freedomDays)}
                      </span>{" "}
                      closer.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {ghostToast && (
          <div className="fixed bottom-6 right-6 z-50 w-[92vw] max-w-sm">
            <div className="rounded-3xl border border-black/10 bg-white/90 p-4 shadow-xl backdrop-blur dark:border-white/10 dark:bg-black/60">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <GhostIcon className="h-5 w-5 animate-bounce" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                      {ghostToast.title}
                    </div>
                  <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {ghostToast.subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGhostToast(null)}
                  className="ml-auto rounded-xl px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
              const invest = investedValueAfterTwoYears(
                effectivePrice,
                expectedAnnualReturn,
              );
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
                          {formatMoney(effectivePrice, currency)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          1 year
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(resale.year1, currency)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          2 years
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(resale.year2, currency)}
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
                          {formatMoney(effectivePrice, currency)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          1 year
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(invest.year1, currency)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          2 years
                        </div>
                        <div className="font-semibold text-zinc-950 dark:text-white">
                          {formatMoney(invest.year2, currency)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      Assumes ~{Math.round(invest.annualRate * 100)}%/yr return
                      .
                    </div>
                  </div>

                  <div className="lg:col-span-2 rounded-2xl bg-black/5 p-4 dark:bg-white/5">
                    <div className="text-sm font-medium text-zinc-950 dark:text-white">
                      Opportunity cost (2 years)
                    </div>
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                      If you invest instead of buy, you could be up about{" "}
                      <span className="font-semibold text-zinc-950 dark:text-white">
                        {formatMoney(Math.max(delta, 0), currency)}
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

function GhostIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12 3c-3.3 0-6 2.7-6 6v10l2-1 2 1 2-1 2 1 2-1 2 1V9c0-3.3-2.7-6-6-6z" />
      <path d="M9.5 10.5h.01" />
      <path d="M14.5 10.5h.01" />
    </svg>
  );
}
