"use client";

import { useEffect, useMemo, useState } from "react";
import { getSubscriptionDangerData } from "@/app/actions";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DangerData = Awaited<ReturnType<typeof getSubscriptionDangerData>>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthsBetween(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 0;
  return Math.max(
    0,
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()),
  );
}

function monthlyCost(amount: number, cadence: "monthly" | "yearly") {
  return cadence === "yearly" ? amount / 12 : amount;
}

function compoundMonthly(balance: number, annualRate: number) {
  const r = annualRate / 12;
  return balance * (1 + r);
}

function projectCurve({
  months,
  initial,
  monthlyContribution,
  annualRate,
}: {
  months: number;
  initial: number;
  monthlyContribution: number;
  annualRate: number;
}) {
  const points: { month: number; value: number }[] = [];
  let v = initial;
  points.push({ month: 0, value: v });
  for (let m = 1; m <= months; m += 1) {
    v = compoundMonthly(v, annualRate) + monthlyContribution;
    points.push({ month: m, value: v });
  }
  return points;
}

export default function SubscriptionDangerCenter() {
  const [data, setData] = useState<DangerData | null>(null);
  const [loading, setLoading] = useState(true);

  const [monthlyInvest, setMonthlyInvest] = useState(200);
  const [cutPct, setCutPct] = useState(25);
  const [bigPurchaseSkip, setBigPurchaseSkip] = useState(500);

  const [usesById, setUsesById] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const next = await getSubscriptionDangerData();
      setData(next);
      setLoading(false);
    })();
  }, []);

  const income = data?.income ?? 0;

  const totals = useMemo(() => {
    const subs = data?.subscriptions ?? [];
    const now = new Date();

    const items = subs.map((s) => {
      const mCost = monthlyCost(s.amount, s.cadence);
      const monthsSoFar = monthsBetween(s.createdAt, now);
      const spendSoFar = mCost * monthsSoFar;
      const uses = usesById[s.id] ?? 0;
      const costPerUse = uses > 0 ? mCost / uses : Infinity;
      const unused = uses === 0;

      return { ...s, mCost, monthsSoFar, spendSoFar, uses, costPerUse, unused };
    });

    const monthlyTotal = items.reduce((sum, i) => sum + i.mCost, 0);
    const lifetimeTotal = items.reduce((sum, i) => sum + i.spendSoFar, 0);
    const savings = monthlyTotal * (clamp(cutPct, 0, 100) / 100);

    return { items, monthlyTotal, lifetimeTotal, savings };
  }, [data, usesById, cutPct]);

  const curves = useMemo(() => {
    const annualRate = 0.08;
    const months = 24;
    const base = projectCurve({
      months,
      initial: 0,
      monthlyContribution: monthlyInvest,
      annualRate,
    });
    const improved = projectCurve({
      months,
      initial: clamp(bigPurchaseSkip, 0, 10_000),
      monthlyContribution: monthlyInvest + totals.savings,
      annualRate,
    });

    return base.map((p, idx) => ({
      month: p.month,
      base: p.value,
      improved: improved[idx]?.value ?? p.value,
    }));
  }, [monthlyInvest, totals.savings, bigPurchaseSkip]);

  const hourlyRate = useMemo(() => {
    // Same assumption as dashboard breakdown: ~80 work hours per pay period (biweekly).
    if (income <= 0) return null;
    return income / 80;
  }, [income]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="text-sm text-zinc-600 dark:text-zinc-300">
          Loading subscription danger center…
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Subscription danger center
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
            Subscriptions that silently eat your future
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Demo math: “work time” uses ~{hourlyRate ? formatMoney(hourlyRate) : "—"}/hr.
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Monthly total
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoney(totals.monthlyTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Lifetime cost
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoney(totals.lifetimeTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Cut savings
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatMoney(totals.savings)}/mo
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          {totals.items.length === 0 ? (
            <div className="rounded-2xl bg-black/5 p-4 text-sm text-zinc-700 dark:bg-white/5 dark:text-zinc-200">
              No subscriptions found.
            </div>
          ) : (
            totals.items.map((s) => {
              const uses = usesById[s.id] ?? 0;
              const danger = s.unused && s.mCost >= 8;
              const workHours =
                hourlyRate && hourlyRate > 0 ? s.mCost / hourlyRate : NaN;

              return (
                <div
                  key={s.id}
                  className={
                    "rounded-2xl border p-4 shadow-sm backdrop-blur " +
                    (danger
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                        {s.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {s.cadence} • started ~{s.monthsSoFar} months ago • spend
                        so far {formatMoney(s.spendSoFar)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                        {formatMoney(s.mCost)}/mo
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                        Work time:{" "}
                        {Number.isFinite(workHours)
                          ? `${Math.round(workHours * 60)}m/mo`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Uses / month
                      </div>
                      <div className="mt-2">
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={1}
                          value={uses}
                          onChange={(e) =>
                            setUsesById((prev) => ({
                              ...prev,
                              [s.id]: Number(e.target.value),
                            }))
                          }
                          className="w-full"
                        />
                        <div className="mt-1 text-xs font-semibold text-zinc-950 dark:text-white tabular-nums">
                          {uses}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Cost / use
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                        {Number.isFinite(s.costPerUse)
                          ? formatMoney(s.costPerUse)
                          : "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        Estimate from your usage slider.
                      </div>
                    </div>

                    <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Unused but paid
                      </div>
                      <div
                        className={
                          "mt-2 text-sm font-semibold " +
                          (s.unused
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-emerald-700 dark:text-emerald-300")
                        }
                      >
                        {s.unused ? "Yes" : "No"}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {s.unused
                          ? "You’re paying with zero usage."
                          : "Looks used."}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
              Scenario sliders
            </div>

            <div className="mt-4 space-y-4">
              <SliderRow
                label="Monthly investing"
                valueLabel={`${formatMoney(monthlyInvest)}/mo`}
                min={0}
                max={1500}
                step={25}
                value={monthlyInvest}
                onChange={setMonthlyInvest}
              />

              <SliderRow
                label="Subscription cuts"
                valueLabel={`${cutPct}%`}
                min={0}
                max={80}
                step={5}
                value={cutPct}
                onChange={setCutPct}
              />

              <SliderRow
                label="Big purchase (skip → invest)"
                valueLabel={formatMoney(bigPurchaseSkip)}
                min={0}
                max={3000}
                step={50}
                value={bigPurchaseSkip}
                onChange={setBigPurchaseSkip}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                Projected net worth curve
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                24 months • ~8%/yr
              </div>
            </div>

            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curves}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={42}
                    tickFormatter={(v) => {
                      if (!Number.isFinite(v)) return "";
                      if (v >= 1000) return `$${Math.round(v / 1000)}k`;
                      return `$${Math.round(v)}`;
                    }}
                  />
                  <Tooltip
                    formatter={(v: unknown) =>
                      typeof v === "number" ? formatMoney(v) : String(v)
                    }
                    labelFormatter={(l) => `Month ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="base"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    dot={false}
                    name="Baseline"
                  />
                  <Line
                    type="monotone"
                    dataKey="improved"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                    name="Cuts + invest"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                Extra invested monthly:{" "}
                <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {formatMoney(totals.savings)}
                </span>
              </div>
              <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                One-time invest:{" "}
                <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {formatMoney(bigPurchaseSkip)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SliderRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {label}
        </div>
        <div className="text-xs font-semibold text-zinc-950 dark:text-white tabular-nums">
          {valueLabel}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
    </div>
  );
}
