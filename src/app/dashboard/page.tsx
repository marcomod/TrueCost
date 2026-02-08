"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DEMO_USER } from "@/lib/api.mock";
import type { DashboardSummary, ExpenseCategory } from "@/lib/contracts";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
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

  async function refreshSummary() {
    setLoading(true);
    const data = await api.getDashboardSummary(DEMO_USER.id);
    setSummary(data);
    setLoading(false);
  }

  useEffect(() => {
    refreshSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onAddExpense(e: FormEvent) {
    e.preventDefault();
    if (savingExpense) return;

    const amount = Number(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      setSavingExpense(true);
      await api.createExpense(DEMO_USER.id, {
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

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (!summary) return <div className="p-6">No data</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add expense
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Income (period)</div>
          <div className="text-2xl font-semibold">
            ${summary.incomeThisPeriod.toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Spent</div>
          <div className="text-2xl font-semibold">
            ${summary.spentThisPeriod.toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Remaining</div>
          <div className="text-2xl font-semibold">
            ${summary.remainingThisPeriod.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-slate-900">
          Where your money went
        </div>

        {summary.spentThisPeriod <= 0 ? (
          <div className="text-sm text-slate-600">
            No expenses yet. Add a purchase to see your breakdown.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.categoryTotals
              .filter((c) => c.total > 0)
              .sort((a, b) => b.total - a.total)
              .map((c) => {
                const pct = (c.total / summary.spentThisPeriod) * 100;
                return (
                  <div
                    key={c.category}
                    className="rounded-md border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-900">
                        {c.category}
                      </div>
                      <div className="text-sm font-semibold">
                        ${c.total.toFixed(2)}
                      </div>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-slate-900"
                        style={{ width: `${Math.min(pct, 100).toFixed(0)}%` }}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {pct.toFixed(0)}% of spending this period
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 text-sm font-medium text-slate-900">
          Recent expenses
        </div>
        <div className="space-y-2">
          {summary.recentExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2"
            >
              <div className="text-sm">
                <div className="font-medium text-slate-900">
                  {expense.note ?? "-"}
                </div>
                <div className="text-xs text-slate-500">
                  {expense.category} • {expense.date}
                </div>
              </div>
              <div className="text-sm font-semibold">
                ${expense.amount.toFixed(2)}
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
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl transition " +
          (drawerOpen
            ? "opacity-100 scale-100"
            : "pointer-events-none opacity-0 scale-95")
        }
        role="dialog"
        aria-modal="true"
        aria-label="Add expense"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">
            Add expense
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onAddExpense} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Amount
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. 7.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                value={expenseCategory}
                onChange={(e) =>
                  setExpenseCategory(e.target.value as ExpenseCategory)
                }
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
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
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Note (optional)
            </label>
            <input
              type="text"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Coffee, lunch, Uber..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingExpense}
              className={
                "w-full rounded-md px-3 py-2 text-sm font-medium text-white " +
                (savingExpense
                  ? "bg-slate-400"
                  : "bg-slate-900 hover:bg-slate-800")
              }
            >
              {savingExpense ? "Saving..." : "Add expense"}
            </button>
          </div>

          <p className="text-center text-[11px] text-slate-500">
            Tip: add your daily purchases here to see your paycheck impact.
          </p>
        </form>
      </div>
    </div>
  );
}
