"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  type SectorProps,
  Tooltip,
  type TooltipProps,
} from "recharts";

export type DonutDatum = {
  key: string;
  label: string;
  value: number;
  color: string;
};

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

function formatWorkTime(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function CustomTooltip({
  active,
  payload,
  total,
  hourlyRate,
  currency,
  stressMultiplier,
}: TooltipProps<number, string> & {
  total: number;
  hourlyRate: number | null;
  currency: string;
  stressMultiplier: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const raw = typeof p.value === "number" ? p.value : 0;
  const pct = total > 0 ? (raw / total) * 100 : 0;
  const workHours =
    hourlyRate && hourlyRate > 0 ? (raw / hourlyRate) * stressMultiplier : NaN;

  const label = (p.name as string | undefined) ?? "Category";
  const color = (p.payload as { color?: string } | undefined)?.color;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/90 p-3 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/50">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: color ?? "#0ea5e9" }}
        />
        <div className="font-semibold text-zinc-950 dark:text-white">
          {label}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
        <div>Spend</div>
        <div className="text-right font-medium text-zinc-950 dark:text-white tabular-nums">
          {formatMoneyWithCurrency(raw, currency)}
        </div>
        <div>Share</div>
        <div className="text-right font-medium text-zinc-950 dark:text-white tabular-nums">
          {pct.toFixed(0)}%
        </div>
        <div>Work time</div>
        <div className="text-right font-medium text-zinc-950 dark:text-white tabular-nums">
          {formatWorkTime(workHours)}
        </div>
      </div>
    </div>
  );
}

export default function DonutBreakdown({
  data,
  total,
  activeKey,
  onActiveKeyChange,
  hourlyRate,
  currency,
  stressMultiplier,
}: {
  data: DonutDatum[];
  total: number;
  activeKey: string | null;
  onActiveKeyChange: (key: string | null) => void;
  hourlyRate: number | null;
  currency: string;
  stressMultiplier?: number;
}) {
  const stress = Number.isFinite(stressMultiplier ?? 1)
    ? (stressMultiplier ?? 1)
    : 1;
  const activeIndex = useMemo(() => {
    if (!activeKey) return -1;
    return data.findIndex((d) => d.key === activeKey);
  }, [activeKey, data]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Breakdown
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
              Spending by category
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
            Total:{" "}
            <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
              {formatMoneyWithCurrency(total, currency)}
            </span>
          </div>
        </div>

        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
                isAnimationActive
                onMouseLeave={() => onActiveKeyChange(null)}
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={(props: SectorProps) => (
                  <Sector
                    {...props}
                    outerRadius={(props.outerRadius ?? 0) + 8}
                    cornerRadius={10}
                  />
                )}
                onMouseEnter={(_, index) => {
                  const k = data[index]?.key ?? null;
                  onActiveKeyChange(k);
                }}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <CustomTooltip
                    total={total}
                    hourlyRate={hourlyRate}
                    currency={currency}
                    stressMultiplier={stress}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Work time uses an estimated hourly rate
          {stress !== 1 ? ` × ${stress.toFixed(1)} stress` : ""}.
        </div>
      </div>

      <div className="lg:col-span-3 space-y-2">
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const active = activeKey === d.key;
          const workHours =
            hourlyRate && hourlyRate > 0
              ? (d.value / hourlyRate) * stress
              : NaN;

          return (
            <div
              key={d.key}
              onMouseEnter={() => onActiveKeyChange(d.key)}
              onMouseLeave={() => onActiveKeyChange(null)}
              className={
                "rounded-2xl border px-4 py-3 shadow-sm backdrop-blur transition " +
                (active
                  ? "border-black/20 bg-white/80 dark:border-white/20 dark:bg-white/10"
                  : "border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5")
              }
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: d.color }}
                    aria-hidden="true"
                  />
                  <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {d.label}
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {formatMoneyWithCurrency(d.value, currency)}
                </div>
              </div>

              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${clamp(pct, 0, 100).toFixed(0)}%`,
                    background: d.color,
                    transition: "width 300ms ease",
                  }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <div>{pct.toFixed(0)}% of spending</div>
                <div className="tabular-nums">
                  Work time: {formatWorkTime(workHours)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
