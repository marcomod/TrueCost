"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addExpense, deleteExpense, getDashboardSummary } from "@/app/actions";
import type { ExpenseCategory } from "@/lib/contracts";
import DonutBreakdown, { type DonutDatum } from "@/component/DonutBreakdown";

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMoneyWithCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function titleCase(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function useAnimatedNumber(target: number, durationMs = 650) {
  const [value, setValue] = useState(target);
  const previousRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousRef.current;
    const to = target;
    previousRef.current = target;

    const start = performance.now();
    const duration = Math.max(durationMs, 1);

    const tick = (now: number) => {
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        setValue(to);
        return;
      }

      const t = clamp((now - start) / duration, 0, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, durationMs]);

  return value;
}

function PaycheckPulse({
  label,
  amount,
  ratio,
  currency,
}: {
  label: string;
  amount: number;
  ratio: number; // 0..1
  currency: string;
}) {
  const pct = Math.round(clamp(ratio, 0, 1) * 100);
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = c * clamp(ratio, 0, 1);
  const gap = c - dash;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      {/* Liquid level */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          transform: `translateY(${(1 - clamp(ratio, 0, 1)) * 100}%)`,
          transition: "transform 900ms cubic-bezier(.2,.8,.2,1)",
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 via-sky-500/10 to-transparent dark:from-emerald-500/15 dark:via-sky-500/10" />
        <div
          className="absolute left-0 top-0 h-10 w-[200%] opacity-60"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,.65), rgba(255,255,255,0))",
            transform: "translateX(-25%)",
            filter: "blur(8px)",
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white tabular-nums">
            {formatMoneyWithCurrency(amount, currency)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {pct}% of income
          </div>
        </div>

        <div className="relative h-16 w-16">
          <svg viewBox="0 0 56 56" className="h-full w-full" aria-hidden="true">
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              stroke="rgba(0,0,0,.08)"
              strokeWidth="6"
              className="dark:hidden"
            />
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,.14)"
              strokeWidth="6"
              className="hidden dark:block"
            />
            <circle
              cx="28"
              cy="28"
              r={r}
              fill="none"
              stroke="url(#pulseGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              transform="rotate(-90 28 28)"
              style={{
                transition:
                  "stroke-dasharray 900ms cubic-bezier(.2,.8,.2,1)",
              }}
            />
            <defs>
              <linearGradient
                id="pulseGradient"
                x1="0"
                y1="0"
                x2="56"
                y2="56"
              >
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
                <stop offset="55%" stopColor="#a855f7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>

          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              {pct}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseCategory, setExpenseCategory] =
    useState<ExpenseCategory>("food");
  const [expenseNote, setExpenseNote] = useState<string>("");
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(
    null,
  );
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(
    null,
  );

  async function refreshSummary() {
    setLoading(true);
    try {
      const data = await getDashboardSummary();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSummary();
  }, []);

  async function onAddExpense(e: FormEvent) {
    e.preventDefault();
    if (savingExpense) return;

    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      setSavingExpense(true);
      await addExpense({
        amount,
        category: expenseCategory,
        date: expenseDate,
        note: expenseNote.trim() ? expenseNote.trim() : undefined,
      });

      // Reset fields (keep category/date for speed)
      setExpenseAmount("");
      setExpenseNote("");
      setDrawerOpen(false);

      await refreshSummary();
    } finally {
      setSavingExpense(false);
    }
  }

  async function onDeleteExpense(expenseId: string) {
    if (deletingExpenseId) return;

    try {
      setDeletingExpenseId(expenseId);
      await deleteExpense(expenseId);
      await refreshSummary();
    } finally {
      setDeletingExpenseId(null);
    }
  }

  const income = summary?.income ?? 0;
  const spent = summary?.spent ?? 0;
  const remaining = summary?.remaining ?? 0;
  const currency = summary?.currency ?? "USD";

  const remainingRatio = useMemo(() => {
    if (income <= 0) return 0;
    return clamp(remaining / income, 0, 1);
  }, [income, remaining]);

  const animatedIncome = useAnimatedNumber(income, 650);
  const animatedSpent = useAnimatedNumber(spent, 650);
  const animatedRemaining = useAnimatedNumber(remaining, 800);

  const categoryData = useMemo(() => {
    const colors: Record<string, string> = {
      food: "#22c55e",
      rent: "#a855f7",
      transport: "#0ea5e9",
      subscriptions: "#f97316",
      shopping: "#e11d48",
      other: "#64748b",
    };

    return Object.entries(summary?.categoryTotals ?? {})
      .map(([key, value]) => ({
        key,
        label: titleCase(key),
        value: typeof value === "number" ? value : 0,
        color: colors[key] ?? "#94a3b8",
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [summary?.categoryTotals]);

  const hourlyRate = summary?.hourlyWage ?? null;
  const stressMultiplier = summary?.stressMultiplier ?? 1;

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!summary) return <div className="p-6">No data</div>;

  return (
    <main className="px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Overview
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Track your paycheck and spending in one place.
            </p>
          </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
        >
          + Add expense
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            Income (period)
          </div>
          <div className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white tabular-nums">
            {formatMoneyWithCurrency(animatedIncome, currency)}
          </div>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Spent</div>
          <div className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white tabular-nums">
            {formatMoneyWithCurrency(animatedSpent, currency)}
          </div>
        </div>

        <PaycheckPulse
          label="Remaining (pulse)"
          amount={animatedRemaining}
          ratio={remainingRatio}
          currency={currency}
        />
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Breakdown
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              Where your money went
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
            Work time assumes ~
            <span className="font-semibold text-zinc-950 dark:text-white">
              {hourlyRate
                ? ` ${formatMoneyWithCurrency(hourlyRate, currency)}/hr`
                : " —"}
            </span>
            {stressMultiplier !== 1 && (
              <span className="tabular-nums"> × {stressMultiplier.toFixed(1)} stress</span>
            )}
          </div>
        </div>

        {summary.spent <= 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            No expenses yet. Add a purchase to see your breakdown.
          </div>
        ) : (
          <DonutBreakdown
            data={categoryData as DonutDatum[]}
            total={summary.spent}
            activeKey={activeCategoryKey}
            onActiveKeyChange={setActiveCategoryKey}
            hourlyRate={hourlyRate}
            currency={currency}
            stressMultiplier={stressMultiplier}
          />
        )}
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mb-3 text-sm font-semibold text-zinc-950 dark:text-white">
          Recent expenses
        </div>
        <div className="space-y-2">
          {summary.recentExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-sm">
                <div className="font-semibold text-zinc-950 dark:text-white">
                  {expense.note ?? "-"}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {expense.category} • {expense.date}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {formatMoneyWithCurrency(expense.amount ?? 0, currency)}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteExpense(expense.id)}
                  disabled={deletingExpenseId === expense.id}
                  className={
                    "rounded-xl px-3 py-2 text-xs font-semibold transition-colors " +
                    (deletingExpenseId === expense.id
                      ? "bg-black/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-300"
                      : "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10")
                  }
                  aria-label={`Delete expense ${expense.note ?? expense.id}`}
                  title="Delete"
                >
                  {deletingExpenseId === expense.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Expense Modal */}
      <div
        className={
          "fixed inset-0 z-40 bg-black/40 transition-opacity " +
          (drawerOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <div
        className={
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur transition dark:border-white/10 dark:bg-black/40 " +
          (drawerOpen
            ? "opacity-100 scale-100"
            : "pointer-events-none opacity-0 scale-95")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Add expense"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-zinc-950 dark:text-white">
            Add expense
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-xl px-2 py-1 text-sm text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onAddExpense} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Amount
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-400 dark:focus:border-white/20"
              placeholder="e.g. 7.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Category
              </label>
              <select
                value={expenseCategory}
                onChange={(e) =>
                  setExpenseCategory(e.target.value as ExpenseCategory)
                }
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
              >
                <option value="food">Food</option>
                <option value="rent">Rent</option>
                <option value="transport">Transport</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="shopping">Shopping</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Note (optional)
            </label>
            <input
              type="text"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-zinc-400 dark:focus:border-white/20"
              placeholder="Coffee, lunch, Uber..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingExpense}
              className={
                "w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors " +
                (savingExpense
                  ? "bg-zinc-950/40 dark:bg-white/20"
                  : "bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90")
              }
            >
              {savingExpense ? "Saving..." : "Add expense"}
            </button>
          </div>

          <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            Tip: add your daily purchases here to see your paycheck impact.
          </p>
        </form>
      </div>
      </div>
    </main>
  );
}
