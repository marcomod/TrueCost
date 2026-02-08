"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { getInsightsData } from "@/app/actions";
import SubscriptionDangerCenter from "@/component/SubscriptionDangerCenter";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

type InsightsData = Awaited<ReturnType<typeof getInsightsData>>;

function VelocityPill({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  if (!Number.isFinite(pct)) {
    return (
      <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
        ↑ new
      </span>
    );
  }

  const up = pct > 0.5;
  const down = pct < -0.5;
  const label = `${up ? "↑" : down ? "↓" : "→"} ${Math.abs(pct).toFixed(0)}% vs last week`;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums",
        up
          ? "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : down
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-black/10 bg-black/5 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function MiniSparkTooltip({
  active,
  payload,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const raw = typeof p.value === "number" ? p.value : 0;
  const dateIso = (p.payload as { date?: string } | undefined)?.date ?? "";

  const dateLabel = (() => {
    const dt = new Date(`${dateIso}T00:00:00`);
    if (!Number.isFinite(dt.getTime())) return dateIso;
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
    }).format(dt);
  })();

  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/50">
      <div className="text-zinc-500 dark:text-zinc-300">{dateLabel}</div>
      <div className="mt-0.5 font-semibold text-zinc-950 dark:text-white tabular-nums">
        {formatMoney(raw, currency)}
      </div>
    </div>
  );
}

function MiniAreaSparkline({
  points,
  currency,
}: {
  points: { date: string; total: number }[];
  currency: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const data = points.map((p) => ({ date: p.date, value: p.total }));
  const max = data.reduce((m, d) => Math.max(m, d.value ?? 0), 0);

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={[0, Math.max(1, max * 1.05)]} />
          <Tooltip content={<MiniSparkTooltip currency={currency} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0b1220"
            strokeWidth={2.5}
            fill={`url(#spark-${gradientId})`}
            isAnimationActive
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Gauge({
  score,
}: {
  score: number; // 0..100
}) {
  const clamped = clamp(score, 0, 100);
  const color =
    clamped >= 80 ? "#22c55e" : clamped >= 60 ? "#eab308" : "#ef4444";

  const segments = [
    { key: "red", value: 33.33, color: "#ef4444" },
    { key: "yellow", value: 33.33, color: "#eab308" },
    { key: "green", value: 33.34, color: "#22c55e" },
  ];

  const progress = [
    { key: "score", value: clamped, color },
    { key: "rest", value: 100 - clamped, color: "rgba(0,0,0,0)" },
  ];

  return (
    <div className="relative h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="100%"
            innerRadius={58}
            outerRadius={78}
            stroke="none"
            isAnimationActive={false}
          >
            {segments.map((s) => (
              <Cell key={s.key} fill={s.color} fillOpacity={0.28} />
            ))}
          </Pie>
          <Pie
            data={progress}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            cx="50%"
            cy="100%"
            innerRadius={64}
            outerRadius={86}
            stroke="none"
            isAnimationActive
          >
            {progress.map((p) => (
              <Cell key={p.key} fill={p.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-2">
        <div className="text-4xl font-semibold tabular-nums text-zinc-950 dark:text-white">
          {Math.round(clamped)}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          out of 100
        </div>
      </div>
    </div>
  );
}

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
    const currency = data.currency ?? "USD";

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
    const prev7Totals = (data.dailyTotalsPrev7 ?? []).map((d) => d.total);
    const avgDaily7 =
      last7Totals.length > 0
        ? last7Totals.reduce((sum, v) => sum + v, 0) / last7Totals.length
        : 0;
    const avgDailyPrev7 =
      prev7Totals.length > 0
        ? prev7Totals.reduce((sum, v) => sum + v, 0) / prev7Totals.length
        : 0;

    const velocityPct =
      avgDailyPrev7 > 0
        ? ((avgDaily7 - avgDailyPrev7) / avgDailyPrev7) * 100
        : avgDaily7 > 0
          ? Infinity
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

    const runwayDays =
      avgDaily7 > 0 ? Math.max(0, Math.floor(remaining / avgDaily7)) : Infinity;

    return {
      income,
      spent,
      remaining,
      currency,
      spendRate,
      remainingRate,
      score,
      last7Totals,
      avgDaily7,
      avgDailyPrev7,
      velocityPct,
      daysToFriday,
      projectedRemainingFriday,
      weekendHeavier,
      runwayDays,
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
  const currency = computed.currency;

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
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                Financial health score
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {scoreLabel}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Burn rate</span>
                  <span className="text-[11px]">⏳</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                  {formatMoney(computed.avgDaily7, currency)}/day
                </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-64">
              <Gauge score={computed.score} />
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
                  ? `${formatMoney(computed.projectedRemainingFriday, currency)} left`
                  : `${formatMoney(Math.abs(computed.projectedRemainingFriday), currency)} over`}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="mr-1">🔮</span>
                Assumes ~{formatMoney(computed.avgDaily7, currency)}/day for{" "}
                {computed.daysToFriday} days.
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Weekend pattern
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                {computed.weekendHeavier
                  ? "Weekends are heavier"
                  : "Steady pattern"}
              </div>
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Weekend avg: {formatMoney(data.weekendAvg, currency)} • Weekday
                avg: {formatMoney(data.weekdayAvg, currency)}
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
                {formatMoney(computed.income, currency)}
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
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                    {formatMoney(computed.spent, currency)}
                  </div>
                  <VelocityPill pct={computed.velocityPct} />
                </div>
                <div className="text-right">
                  <MiniAreaSparkline
                    points={data.dailyTotalsLast7}
                    currency={currency}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Remaining
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                {formatMoney(computed.remaining, currency)}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                {Number.isFinite(computed.runwayDays)
                  ? `Estimated ${computed.runwayDays} days of runway left`
                  : "Estimated runway: ∞"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
