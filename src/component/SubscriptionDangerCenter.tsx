"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addSubscription,
  deleteSubscription,
  getSubscriptionDangerData,
} from "@/app/actions";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";

type DangerData = Awaited<ReturnType<typeof getSubscriptionDangerData>>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMoneyWithCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency,
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

function futureValueMonthly({
  monthly,
  annualRate,
  months,
}: {
  monthly: number;
  annualRate: number;
  months: number;
}) {
  const r = annualRate / 12;
  if (!Number.isFinite(r) || r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
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

function roundTo(n: number, step: number) {
  if (!Number.isFinite(n)) return 0;
  if (!Number.isFinite(step) || step <= 0) return n;
  return Math.round(n / step) * step;
}

function pctFromLogValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = clamp(value, min, max);
  const lo = Math.log(min);
  const hi = Math.log(max);
  const p = (Math.log(v) - lo) / (hi - lo);
  return clamp(p, 0, 1) * 100;
}

function logValueFromPct(pct: number, min: number, max: number) {
  const p = clamp(pct, 0, 100) / 100;
  if (p <= 0) return 0;
  const lo = Math.log(min);
  const hi = Math.log(max);
  return Math.exp(lo + p * (hi - lo));
}

function extraGoalText(extra: number) {
  const amt = Math.max(0, extra);
  if (!Number.isFinite(amt) || amt <= 0) return "Less spent, more options.";
  if (amt >= 4200)
    return `That’s enough for a trip to Japan.`;
  if (amt >= 1500)
    return `That’s a weekend getaway fund.`;
  if (amt >= 500)
    return `That’s a month of groceries for a lot of people.`;
  return `That’s a meaningful buffer.`;
}

function ProjectionsTooltip({
  active,
  payload,
  label,
  currency,
}: TooltipProps<number, string> & { currency: string }) {
  if (!active || !payload?.length) return null;

  const month = typeof label === "number" ? label : Number(label);
  const year = Number.isFinite(month) ? Math.max(0, month) / 12 : 0;

  const base = payload.find((p) => p.dataKey === "base")?.value;
  const improved = payload.find((p) => p.dataKey === "improved")?.value;
  const baseN = typeof base === "number" ? base : 0;
  const improvedN = typeof improved === "number" ? improved : 0;
  const extra = improvedN - baseN;
  const yearLabel =
    Number.isFinite(month) && month % 12 === 0
      ? `Year ${Math.round(month / 12)}`
      : Number.isFinite(year)
        ? `Year ${year.toFixed(1)}`
        : "Future";

  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 p-3 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-zinc-600 dark:text-zinc-300">
            {yearLabel}
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
            By skipping these subscriptions, you’d have an extra{" "}
            {formatMoneyWithCurrency(extra, currency)}.
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {extraGoalText(extra)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        <div>Current path</div>
        <div className="text-right font-medium text-zinc-950 dark:text-white tabular-nums">
          {formatMoneyWithCurrency(baseN, currency)}
        </div>
        <div>Optimized path</div>
        <div className="text-right font-medium text-zinc-950 dark:text-white tabular-nums">
          {formatMoneyWithCurrency(improvedN, currency)}
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionDangerCenter() {
  const [data, setData] = useState<DangerData | null>(null);
  const [loading, setLoading] = useState(true);

  const [monthlyInvest, setMonthlyInvest] = useState(200);
  const [cutPct, setCutPct] = useState(25);
  const [bigPurchaseSkip, setBigPurchaseSkip] = useState(500);

  const [usesById, setUsesById] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState<string>("");
  const [addCadence, setAddCadence] = useState<"monthly" | "yearly">("monthly");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const next = await getSubscriptionDangerData();
      setData(next);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const currency = data?.currency ?? "USD";
  const expectedAnnualReturn = data?.expectedAnnualReturn ?? 0.08;
  const hourlyRate = data?.hourlyWage ?? null;
  const stressMultiplier = data?.stressMultiplier ?? 1;

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
    const months = 120; // 10 years
    const base = projectCurve({
      months,
      initial: 0,
      monthlyContribution: monthlyInvest,
      annualRate: expectedAnnualReturn,
    });
    const improved = projectCurve({
      months,
      initial: clamp(bigPurchaseSkip, 0, 10_000),
      monthlyContribution: monthlyInvest + totals.savings,
      annualRate: expectedAnnualReturn,
    });

    return base.map((p, idx) => {
      const improvedValue = improved[idx]?.value ?? p.value;
      return {
        month: p.month,
        base: p.value,
        improved: improvedValue,
        gap: Math.max(0, improvedValue - p.value),
      };
    });
  }, [monthlyInvest, totals.savings, bigPurchaseSkip, expectedAnnualReturn]);

  const yearTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let m = 0; m <= 120; m += 12) ticks.push(m);
    return ticks;
  }, []);

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
            Work time uses ~
            {hourlyRate
              ? `${formatMoneyWithCurrency(hourlyRate, currency)}/hr`
              : "—"}
            {stressMultiplier !== 1
              ? ` × ${stressMultiplier.toFixed(1)} stress`
              : ""}
            .
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Monthly total
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoneyWithCurrency(totals.monthlyTotal, currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Lifetime cost
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoneyWithCurrency(totals.lifetimeTotal, currency)}
            </div>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/60 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Cut savings
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatMoneyWithCurrency(totals.savings, currency)}/mo
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setAddMsg(null);
              setAddOpen((o) => !o);
            }}
            className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
          >
            {addOpen ? "Close" : "+ Add subscription"}
          </button>
        </div>
      </div>

      {addOpen && (
        <div className="mt-5 rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                Add a subscription
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                This powers the projections + danger center.
              </div>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {addMsg ?? " "}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Name
              </label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                placeholder="Netflix, Spotify…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Amount
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                placeholder="11.99"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Cadence
              </label>
              <select
                value={addCadence}
                onChange={(e) =>
                  setAddCadence(e.target.value as "monthly" | "yearly")
                }
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={addBusy}
              onClick={async () => {
                if (addBusy) return;
                const name = addName.trim();
                const amount = Number(addAmount);
                if (!name) {
                  setAddMsg("Name is required.");
                  return;
                }
                if (!Number.isFinite(amount) || amount <= 0) {
                  setAddMsg("Amount must be > 0.");
                  return;
                }

                try {
                  setAddBusy(true);
                  setAddMsg(null);
                  await addSubscription({
                    name,
                    amount,
                    cadence: addCadence,
                  });
                  setAddName("");
                  setAddAmount("");
                  setAddCadence("monthly");
                  setAddMsg("Added.");
                  await refresh();
                } finally {
                  setAddBusy(false);
                }
              }}
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-900 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
            >
              {addBusy ? "Adding…" : "Add subscription"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <div className="space-y-3">
          {totals.items.length === 0 ? (
            <div className="rounded-2xl bg-black/5 p-4 text-sm text-zinc-700 dark:bg-white/5 dark:text-zinc-200">
              No subscriptions found. Add one above to power this section.
            </div>
          ) : (
            totals.items.map((s) => {
              const uses = usesById[s.id] ?? 0;
              const danger = s.unused && s.mCost >= 8;
              const workHours =
                hourlyRate && hourlyRate > 0
                  ? (s.mCost / hourlyRate) * stressMultiplier
                  : NaN;

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
                        so far {formatMoneyWithCurrency(s.spendSoFar, currency)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          {formatMoneyWithCurrency(s.mCost, currency)}/mo
                        </div>
                        <button
                          type="button"
                          disabled={deletingId === s.id}
                          onClick={async () => {
                            if (
                              typeof window !== "undefined" &&
                              !window.confirm(`Delete “${s.name}”?`)
                            )
                              return;
                            setDeletingId(s.id);
                            try {
                              await deleteSubscription(s.id);
                              await refresh();
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="rounded-xl border border-black/10 bg-white/60 px-2 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-white/80 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                          aria-label={`Delete subscription ${s.name}`}
                        >
                          {deletingId === s.id ? "Deleting…" : "Delete"}
                        </button>
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
                          ? formatMoneyWithCurrency(s.costPerUse, currency)
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

        <div className="rounded-3xl border border-black/10 bg-white/60 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Projections
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                Net worth curve (vice vs. virtue)
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              10 years • ~{Math.round(expectedAnnualReturn * 100)}%/yr
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Live controls
              </div>
              <div className="mt-3 space-y-5">
                {(() => {
                  const horizonMonths = 120;
                  const invest10y = futureValueMonthly({
                    monthly: monthlyInvest,
                    annualRate: expectedAnnualReturn,
                    months: horizonMonths,
                  });
                  const investLabel = `~${formatMoneyWithCurrency(invest10y, currency)} over 10y`;

                  return (
                    <ControlSlider
                      label="Monthly investing"
                      badge={`${formatMoneyWithCurrency(monthlyInvest, currency)}/mo`}
                      description={investLabel}
                      min={0}
                      max={1500}
                      step={25}
                      value={monthlyInvest}
                      onChange={setMonthlyInvest}
                    />
                  );
                })()}

                {(() => {
                  const monthlySaved = totals.savings;
                  const saved10y = monthlySaved * 12 * 10;
                  const desc = `Saves ${formatMoneyWithCurrency(monthlySaved, currency)}/mo • ~${formatMoneyWithCurrency(saved10y, currency)} over 10y`;
                  return (
                    <ControlSlider
                      label="Subscription cuts"
                      badge={`${cutPct}%`}
                      description={desc}
                      min={0}
                      max={80}
                      step={5}
                      value={cutPct}
                      onChange={setCutPct}
                    />
                  );
                })()}

                {(() => {
                  const min = 100;
                  const max = 10_000;
                  const pct = pctFromLogValue(bigPurchaseSkip, min, max);
                  const desc =
                    bigPurchaseSkip <= 0
                      ? "Try skipping one big impulse buy and invest it instead."
                      : `One-time invest impact: ${formatMoneyWithCurrency(bigPurchaseSkip, currency)}.`;

                  return (
                    <ControlSlider
                      label="Big purchase (skip → invest)"
                      badge={formatMoneyWithCurrency(bigPurchaseSkip, currency)}
                      description={desc}
                      min={0}
                      max={100}
                      step={1}
                      value={pct}
                      onChange={(p) => {
                        const v = logValueFromPct(p, min, max);
                        setBigPurchaseSkip(roundTo(v, 50));
                      }}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-3xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    Wealth gap (shaded)
                  </div>
                  <div className="text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                    Hover a year for the “lost opportunity”
                  </div>
                </div>

                <div className="mt-3 h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={curves}>
                      <CartesianGrid stroke="rgba(0,0,0,0.06)" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11 }}
                        ticks={yearTicks}
                        tickFormatter={(m) => `Y${Math.round(m / 12)}`}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={56}
                        tickFormatter={(v) => {
                          if (!Number.isFinite(v)) return "";
                          const symbol =
                            currency === "CAD" ? "CA$" : currency === "USD" ? "$" : "";
                          if (v >= 1000) return `${symbol}${Math.round(v / 1000)}k`;
                          return `${symbol}${Math.round(v)}`;
                        }}
                      />

                      {(() => {
                        const maxY = curves.reduce(
                          (m, p) => Math.max(m, p.improved ?? 0),
                          0,
                        );
                        const emergency = Math.max(1000, data?.income ?? 0);
                        const freedom = 100_000;

                        return (
                          <>
                            {emergency > 0 && emergency <= maxY * 1.15 && (
                              <ReferenceLine
                                y={emergency}
                                stroke="rgba(148,163,184,0.9)"
                                strokeDasharray="6 6"
                                label={{
                                  value: "Emergency fund reached",
                                  position: "insideTopRight",
                                  fill: "rgba(100,116,139,0.9)",
                                  fontSize: 11,
                                }}
                              />
                            )}
                            {freedom > 0 && freedom <= maxY * 1.15 && (
                              <ReferenceLine
                                y={freedom}
                                stroke="rgba(34,197,94,0.55)"
                                strokeDasharray="6 6"
                                label={{
                                  value: "Freedom number",
                                  position: "insideTopRight",
                                  fill: "rgba(16,185,129,0.9)",
                                  fontSize: 11,
                                }}
                              />
                            )}
                          </>
                        );
                      })()}

                      <Tooltip content={<ProjectionsTooltip currency={currency} />} />

                      <defs>
                        <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {/* Stack base + gap to shade between lines */}
                      <Area
                        type="monotone"
                        dataKey="base"
                        stackId="path"
                        stroke="transparent"
                        fill="transparent"
                        isAnimationActive
                      />
                      <Area
                        type="monotone"
                        dataKey="gap"
                        stackId="path"
                        stroke="transparent"
                        fill="url(#gapFill)"
                        isAnimationActive
                        name="Lost opportunity"
                      />

                      <Line
                        type="monotone"
                        dataKey="base"
                        stroke="#60a5fa"
                        strokeWidth={2.25}
                        dot={false}
                        name="Current path"
                      />
                      <Line
                        type="monotone"
                        dataKey="improved"
                        stroke="#22c55e"
                        strokeWidth={2.75}
                        dot={false}
                        name="Optimized path"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                  <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                    Extra invested monthly:{" "}
                    <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {formatMoneyWithCurrency(totals.savings, currency)}
                    </span>
                  </div>
                  <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                    One-time invest:{" "}
                    <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {formatMoneyWithCurrency(bigPurchaseSkip, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlSlider({
  label,
  badge,
  description,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  badge: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const pct =
    max > min ? clamp(((value - min) / (max - min)) * 100, 0, 100) : 0;
  const badgeTransform =
    pct < 12 ? "translateX(0)" : pct > 88 ? "translateX(-100%)" : "translateX(-50%)";
  return (
    <div className="rounded-3xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {label}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {description}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(n);
          }}
          className="w-full"
        />

        <div className="relative mt-3 h-9">
          <div
            className="pointer-events-none absolute top-0 rounded-2xl border border-black/10 bg-white/90 px-3 py-1 text-sm font-semibold text-zinc-950 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/40 dark:text-white"
            style={{ left: `${pct}%`, transform: badgeTransform }}
          >
            {badge}
          </div>
        </div>
      </div>
    </div>
  );
}
