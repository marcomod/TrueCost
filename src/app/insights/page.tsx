"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_USER } from "@/lib/api.mock";
import type { DashboardSummary, ExpenseCategory } from "@/lib/contracts";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InsightsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await api.getDashboardSummary(DEMO_USER.id);
      setSummary(data);
      setLoading(false);
    })();
  }, []);

  const computed = useMemo(() => {
    if (!summary) return null;

    const income = summary.incomeThisPeriod;
    const spent = summary.spentThisPeriod;
    const remaining = summary.remainingThisPeriod;

    const spendRate = income > 0 ? spent / income : 0; // 0..1+
    const remainingRate = income > 0 ? remaining / income : 0;

    const getCatTotal = (cat: ExpenseCategory) =>
      summary.categoryTotals.find((c) => c.category === cat)?.total ?? 0;

    const subsTotal = getCatTotal("subscriptions");
    const foodTotal = getCatTotal("food");

    const subsRate = income > 0 ? subsTotal / income : 0;
    const foodRate = income > 0 ? foodTotal / income : 0;

    // Simple, hackathon-friendly score:
    // - penalize high spend rate
    // - penalize heavy subscriptions
    // - reward remaining rate
    let score = 100;
    score -= clamp(spendRate * 70, 0, 70);
    score -= clamp(subsRate * 40, 0, 40);
    score += clamp(remainingRate * 20, 0, 20);
    score = clamp(score, 0, 100);

    // Determine top category by total
    const topCat = [...summary.categoryTotals]
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)[0];

    return {
      income,
      spent,
      remaining,
      spendRate,
      remainingRate,
      subsTotal,
      subsRate,
      foodTotal,
      foodRate,
      score,
      topCat,
    };
  }, [summary]);

  if (loading) return <div className="p-6">Loading insights...</div>;
  if (!summary || !computed) return <div className="p-6">No data</div>;

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
  const subsPct = formatPct(computed.subsRate * 100);
  const foodPct = formatPct(computed.foodRate * 100);

  return (
    <main className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-slate-600">
          Quick signals based on this pay period’s spending.
        </p>
      </div>

      {/* Health Score */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-slate-900">
              Financial health score
            </div>
            <div className="mt-1 text-sm text-slate-600">{scoreLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-semibold tabular-nums">
              {Math.round(computed.score)}
            </div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-slate-900"
            style={{ width: `${computed.score}%` }}
            aria-hidden="true"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Spent</div>
            <div className="text-sm font-semibold">{spendPct}</div>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Remaining</div>
            <div className="text-sm font-semibold">{remainingPct}</div>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Subscriptions</div>
            <div className="text-sm font-semibold">{subsPct}</div>
          </div>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">
            Subscription burden
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {computed.subsTotal > 0
              ? `Subscriptions are ${subsPct} of your income this period.`
              : "No subscription spending logged this period."}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Tip: even one unused subscription can quietly compound.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">
            Food spending signal
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {computed.foodTotal > 0
              ? `Food is ${foodPct} of your income this period.`
              : "No food purchases logged yet."}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Tip: small daily buys are the easiest to forget.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-medium text-slate-900">
            Biggest category
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {computed.topCat
              ? `${titleCase(computed.topCat.category)} is currently your top category.`
              : "Add a few purchases to see what dominates your spending."}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Tip: reducing your #1 category moves the needle fastest.
          </div>
        </div>
      </div>

      {/* Small summary strip */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Snapshot</div>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Income</div>
            <div className="text-sm font-semibold">
              ${computed.income.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Spent</div>
            <div className="text-sm font-semibold">
              ${computed.spent.toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="text-xs text-slate-500">Remaining</div>
            <div className="text-sm font-semibold">
              ${computed.remaining.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
