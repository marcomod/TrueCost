"use client";

import { useEffect, useMemo, useState } from "react";
import { getInsightsData } from "@/app/actions";
import SubscriptionDangerCenter from "@/component/SubscriptionDangerCenter";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function Sparkline({
  values,
}: {
  values: number[];
}) {
  const width = 140;
  const height = 42;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((v, i) => {
      const x = pad + (i * (width - pad * 2)) / Math.max(values.length - 1, 1);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-zinc-950 dark:text-white"
      />
    </svg>
  );
}

type InsightsData = Awaited<ReturnType<typeof getInsightsData>>;

function nextFriday(from: Date) {
  // 5 = Friday
  const day = from.getDay();
  const delta = (5 - day + 7) % 7 || 7;
  const d = new Date(from);
  d.setDate(d.getDate() + delta);
  return d;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const next = await getInsightsData();
      setData(next);
      setLoading(false);
    })();
  }, []);

  const computed = useMemo(() => {
    if (!data) return null;

    const income = data.income;
    const spent = data.spent30;
    const remaining = data.remaining;

    const spendRate = income > 0 ? spent / income : 0; // 0..1+
    const remainingRate = income > 0 ? remaining / income : 0;

    // Simple, hackathon-friendly score:
    // - penalize high spend rate
    // - reward remaining rate
    let score = 100;
    score -= clamp(spendRate * 70, 0, 70);
    score += clamp(remainingRate * 20, 0, 20);
    score = clamp(score, 0, 100);

    const last7Totals = data.dailyTotalsLast7.map((d) => d.total);
    const avgDaily7 =
      last7Totals.length > 0
        ? last7Totals.reduce((sum, v) => sum + v, 0) / last7Totals.length
        : 0;

    const today = new Date();
    const friday = nextFriday(today);
    const daysToFriday = Math.max(
      1,
      Math.ceil((friday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const projectedSpendToFriday = avgDaily7 * daysToFriday;
    const projectedRemainingFriday = remaining - projectedSpendToFriday;

    const weekendHeavier =
      data.weekendAvg > 0 && data.weekendAvg > data.weekdayAvg * 1.35;

    return {
      income,
      spent,
      remaining,
      spendRate,
      remainingRate,
      score,
      last7Totals,
      avgDaily7,
      daysToFriday,
      projectedRemainingFriday,
      weekendHeavier,
    };
  }, [data]);

  if (loading) return <div className="p-6">Loading insights...</div>;
  if (!data || !computed) return <div className="p-6">No data</div>;

  const scoreLabel =
    computed.score >= 80
      ? "Strong"
      : computed.score >= 60
        ? "Okay"
        : computed.score >= 40
          ? "Risky"
          : "Critical";

  const spendPct = formatPct(computed.spendRate * 100);
  const remainingPct = formatPct(computed.remainingRate * 100);

  return (
    <main className="px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Signals
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Insights
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Quick signals based on this pay period’s spending.
          </p>
        </div>

      {/* Health Score */}
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-zinc-950 dark:text-white">
              Financial health score
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {scoreLabel}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-semibold tabular-nums text-zinc-950 dark:text-white">
              {Math.round(computed.score)}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              out of 100
            </div>
          </div>
        </div>

        <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full bg-zinc-950 dark:bg-white"
            style={{ width: `${computed.score}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Spent
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {spendPct}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Remaining
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {remainingPct}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Burn rate
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {formatMoney(computed.avgDaily7)}/day
            </div>
          </div>
        </div>
      </div>

      {/* Predictive Signals */}
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Predictive signals
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              What happens if you keep spending like this?
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
            Based on last 7 days
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Forecast to next Friday
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {computed.projectedRemainingFriday >= 0
                ? `${formatMoney(computed.projectedRemainingFriday)} left`
                : `${formatMoney(Math.abs(computed.projectedRemainingFriday))} over`}
            </div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Assumes ~{formatMoney(computed.avgDaily7)}/day for{" "}
              {computed.daysToFriday} days.
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Weekend pattern
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {computed.weekendHeavier ? "Weekends are heavier" : "Steady pattern"}
            </div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Weekend avg: {formatMoney(data.weekendAvg)} • Weekday avg:{" "}
              {formatMoney(data.weekdayAvg)}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Suggestion
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              {computed.projectedRemainingFriday < 200
                ? "Slow down this week"
                : "You’re on track"}
            </div>
            <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Try pausing 1–2 impulse buys and re-check tomorrow.
            </div>
          </div>
        </div>
      </div>

      <SubscriptionDangerCenter />

      {/* Small summary strip */}
      <div className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="text-sm font-semibold text-zinc-950 dark:text-white">
          Snapshot
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Income
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoney(computed.income)}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Spent (last 30 days)
              </div>
              <div className="w-24 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                last 7 days
              </div>
            </div>
            <div className="mt-1 grid grid-cols-2 items-end gap-3">
              <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                {formatMoney(computed.spent)}
              </div>
              <div className="text-right">
                <Sparkline values={computed.last7Totals} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Remaining
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoney(computed.remaining)}
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
