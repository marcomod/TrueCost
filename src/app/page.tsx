"use client";

import { FormEvent, useMemo, useState } from "react";

type Frequency = "one-time" | "daily" | "weekly" | "monthly";

const EXAMPLES = [
  "$7 coffee weekly",
  "$180 sneakers one-time",
  "$15 subscription monthly",
  "$12 lunch daily",
];

function parseQuery(q: string): {
  amount: number | null;
  frequency: Frequency;
} {
  const lower = q.toLowerCase();

  // amount: match $7, 7, 7.50
  const m = lower.match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  const amount = m ? Number(m[1]) : null;

  let frequency: Frequency = "one-time";
  if (/(daily|every day|per day|a day)/.test(lower)) frequency = "daily";
  else if (/(weekly|per week|a week|every week)/.test(lower))
    frequency = "weekly";
  else if (/(monthly|per month|a month|every month)/.test(lower))
    frequency = "monthly";
  else if (/(one[-\s]?time|once|single)/.test(lower)) frequency = "one-time";

  return { amount: Number.isFinite(amount ?? NaN) ? amount : null, frequency };
}

function occurrencesOverTwoYears(freq: Frequency): number {
  // Use simple approximations for a hackathon demo
  if (freq === "daily") return 365 * 2;
  if (freq === "weekly") return 52 * 2;
  if (freq === "monthly") return 12 * 2;
  return 1;
}

function futureValueMonthlyContribution(
  monthlyContribution: number,
  years: number,
  annualRate: number,
) {
  // FV of annuity: P * [((1+r)^n - 1)/r]
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return monthlyContribution * n;
  return monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
  const [ghostAdded, setGhostAdded] = useState(false);

  const result = useMemo(() => {
    if (!submittedQuery) return null;

    const { amount, frequency } = parseQuery(submittedQuery);
    if (amount == null) {
      return {
        ok: false as const,
        message: "Try including a price like $7, $15.99, or 180.",
      };
    }

    const occ = occurrencesOverTwoYears(frequency);
    const totalCost = amount * occ;

    // Opportunity cost: assume 8% annual return, compounded monthly.
    // If it's recurring, convert to monthly contribution.
    const annualRate = 0.08;
    let monthly = 0;
    if (frequency === "daily")
      monthly = amount * 30; // approx
    else if (frequency === "weekly")
      monthly = amount * 4.33; // approx
    else if (frequency === "monthly") monthly = amount;
    else monthly = 0;

    const investedValue =
      monthly > 0
        ? futureValueMonthlyContribution(monthly, 2, annualRate)
        : amount * Math.pow(1 + annualRate, 2);

    // Simple insight string
    const insight =
      frequency === "one-time"
        ? `If you invested $${amount.toFixed(2)} instead, it could be about $${investedValue.toFixed(2)} in ~2 years (assuming 8%/yr).`
        : `Over 2 years, this habit costs about $${totalCost.toFixed(2)}. Investing the same amount monthly could grow to ~$${investedValue.toFixed(2)} (8%/yr).`;

    return {
      ok: true as const,
      amount,
      frequency,
      occurrences: occ,
      totalCost,
      investedValue,
      insight,
    };
  }, [submittedQuery]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setGhostAdded(false);
    setSubmittedQuery(query.trim());
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            TrueCost
          </h1>
          <p className="text-sm text-slate-600">
            Type what you want to buy. See the real cost over time.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "$7 coffee weekly"'
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>

        {/* Results */}
        {submittedQuery && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Query</div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {submittedQuery}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubmittedQuery(null)}
                className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                aria-label="Clear"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              {result && !result.ok ? (
                <div className="text-sm text-slate-700">{result.message}</div>
              ) : result && result.ok ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">2-year cost</div>
                      <div className="text-lg font-semibold">
                        ${result.totalCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">Frequency</div>
                      <div className="text-lg font-semibold">
                        {result.frequency}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <div className="text-xs text-slate-500">
                        Invested instead
                      </div>
                      <div className="text-lg font-semibold">
                        ${result.investedValue.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-800">
                      {result.insight}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Assumes ~8% annual return. Estimates are approximate.
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setGhostAdded(true)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                    >
                      Add to Ghost Cart
                    </button>
                    {ghostAdded && (
                      <div className="text-sm text-slate-600">
                        Added. We’ll treat it like “money invested” in your
                        demo.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">No results.</div>
              )}
            </div>
          </div>
        )}

        {/* Small footer note */}
        <div className="text-center text-xs text-slate-500">
          Phase 3: search UI + result panel (mock math). Next: Ghost Cart
          history + tying results into dashboard.
        </div>
      </div>
    </main>
  );
}
