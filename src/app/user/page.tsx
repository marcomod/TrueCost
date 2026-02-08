"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  deleteGhostCartItem,
  getGhostCartData,
  getMyProfile,
  signIn,
  signOut,
  signUp,
  updateMySettings,
} from "@/app/actions";
import type { PayFrequency } from "@/lib/contracts";

type Profile = Awaited<ReturnType<typeof getMyProfile>>;
type GhostCartData = Awaited<ReturnType<typeof getGhostCartData>>;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
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

function computeIncomeThisPeriod(
  hourlyWage: number,
  payFrequency: PayFrequency,
) {
  const hours =
    payFrequency === "weekly" ? 40 : payFrequency === "biweekly" ? 80 : 160;
  return hourlyWage * hours;
}

export default function UserPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ghostCart, setGhostCart] = useState<GhostCartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ghostBusyId, setGhostBusyId] = useState<string | null>(null);

  const [themeMode, setThemeMode] = useState<"dark" | "light">("light");

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [hourlyWage, setHourlyWage] = useState<string>("");
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("biweekly");
  const [currency, setCurrency] = useState<"CAD" | "USD">("CAD");
  const [expectedReturnPct, setExpectedReturnPct] = useState<string>("8");
  const [jobSatisfaction, setJobSatisfaction] = useState<number>(7);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function refreshProfile() {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([getMyProfile(), getGhostCartData()]);
      setProfile(p);
      setGhostCart(g);

      setHourlyWage(String(p.settings.hourlyWage ?? 0));
      setPayFrequency(p.settings.payFrequency);
      setCurrency(p.settings.currency);
      setExpectedReturnPct(
        String(Math.round((p.settings.expectedAnnualReturn ?? 0.08) * 100)),
      );
      setJobSatisfaction(clamp(Number(p.settings.jobSatisfaction ?? 7), 1, 10));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshProfile();
  }, []);

  function applyTheme(mode: "dark" | "light") {
    const root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("tc_theme");
      const mode = stored === "dark" || stored === "light" ? stored : "light";
      setThemeMode(mode);
      applyTheme(mode);
    } catch {
      // ignore
    }
  }, []);

  function setTheme(mode: "dark" | "light") {
    setThemeMode(mode);
    try {
      window.localStorage.setItem("tc_theme", mode);
    } catch {
      // ignore
    }
    applyTheme(mode);
  }

  const computedIncome = useMemo(() => {
    const wage = Number(hourlyWage);
    if (!Number.isFinite(wage) || wage <= 0) return 0;
    return computeIncomeThisPeriod(wage, payFrequency);
  }, [hourlyWage, payFrequency]);

  const stressMultiplier = useMemo(() => {
    const s = clamp(Number(jobSatisfaction), 1, 10);
    return 1 + (10 - s) * 0.1;
  }, [jobSatisfaction]);

  async function onDeleteGhost(itemId: string) {
    if (!itemId) return;
    if (ghostBusyId) return;
    try {
      setGhostBusyId(itemId);
      await deleteGhostCartItem(itemId);
      const g = await getGhostCartData();
      setGhostCart(g);
      router.refresh();
    } finally {
      setGhostBusyId(null);
    }
  }

  async function onAuthSubmit() {
    if (authBusy) return;
    setAuthError(null);

    try {
      setAuthBusy(true);
      const result =
        authMode === "signup"
          ? await signUp({
              name: authName,
              email: authEmail,
              password: authPassword,
            })
          : await signIn({ email: authEmail, password: authPassword });

      if (!result.ok) {
        setAuthError(result.error);
        return;
      }

      setAuthPassword("");
      setAuthError(null);
      await refreshProfile();
      router.refresh();
    } finally {
      setAuthBusy(false);
    }
  }

  async function onSignOut() {
    await signOut();
    await refreshProfile();
    router.refresh();
  }

  async function onSaveSettings() {
    if (saveBusy) return;
    setSaveMsg(null);

    const wage = clamp(Number(hourlyWage), 0, 10_000);
    const expectedPct = clamp(Number(expectedReturnPct), 0, 100);
    const satisfaction = clamp(Number(jobSatisfaction), 1, 10);

    try {
      setSaveBusy(true);
      await updateMySettings({
        hourlyWage: wage,
        payFrequency,
        currency,
        expectedAnnualReturn: expectedPct / 100,
        jobSatisfaction: satisfaction,
      });
      setSaveMsg("Saved.");
      await refreshProfile();
      router.refresh();
    } finally {
      setSaveBusy(false);
    }
  }

  if (loading) return <div className="p-6">Loading user settings…</div>;
  if (!profile) return <div className="p-6">No profile</div>;

  const ghostCurrency = ghostCart?.currency ?? currency;
  const totalLifeWealthSaved = ghostCart?.originalTotal ?? 0;
  const growthBonus = ghostCart?.growthBonus ?? 0;
  const currentGhostValue = ghostCart?.currentTotal ?? 0;

  return (
    <main className="px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Account
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            User Settings
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Set your baseline so “Work Time”, paycheck visuals, and projections
            feel real.
          </p>
        </div>

        <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                {profile.isDemo ? "Not signed in" : "Signed in"}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {profile.isDemo
                  ? "Create an account to save settings across devices."
                  : `${profile.user.name}${profile.user.email ? ` • ${profile.user.email}` : ""}`}
              </div>
            </div>
            {!profile.isDemo && (
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-2xl border border-black/10 bg-white/60 px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm backdrop-blur hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            )}
          </div>

          {profile.isDemo && (
            <div className="mt-5">
              <div className="inline-flex rounded-2xl border border-black/10 bg-white/60 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={
                    "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                    (authMode === "signup"
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                  }
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  className={
                    "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                    (authMode === "signin"
                      ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                      : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                  }
                >
                  Sign in
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                {authMode === "signup" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                      Name
                    </label>
                    <input
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    Email
                  </label>
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                    placeholder="you@example.com"
                    inputMode="email"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                    Password
                  </label>
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                    placeholder="At least 8 characters"
                    type="password"
                    autoComplete={
                      authMode === "signup"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                </div>

                {authError && (
                  <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                    {authError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onAuthSubmit}
                  disabled={authBusy}
                  className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
                >
                  {authBusy
                    ? "Working…"
                    : authMode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Financial baseline
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                Used across Work Time + paycheck visuals
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              Est. income this period: {computedIncome.toFixed(0)} {currency}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Hourly wage (post-tax)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={hourlyWage}
                onChange={(e) => setHourlyWage(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                placeholder="e.g. 30"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Pay period cycle
              </label>
              <select
                value={payFrequency}
                onChange={(e) =>
                  setPayFrequency(e.target.value as PayFrequency)
                }
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "CAD" | "USD")}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
              >
                <option value="CAD">CAD (Canada)</option>
                <option value="USD">USD (United States)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Expected annual return
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step="0.1"
                value={expectedReturnPct}
                onChange={(e) => setExpectedReturnPct(e.target.value)}
                className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-950 outline-none focus:border-black/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-white/20"
                placeholder="8"
              />
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Used in opportunity cost charts (
                {formatPct(Number(expectedReturnPct) / 100)}).
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                  Misery index (sweat equity)
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  If you hate your job, work time “cost” feels heavier.
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                  {jobSatisfaction}/10
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  ×{stressMultiplier.toFixed(1)} stress
                </div>
              </div>
            </div>

            <div className="mt-3">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={jobSatisfaction}
                onChange={(e) => setJobSatisfaction(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <div>1 = miserable</div>
                <div>10 = love it</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {saveMsg ?? " "}
            </div>
            <button
              type="button"
              onClick={onSaveSettings}
              disabled={saveBusy}
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-900 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
            >
              {saveBusy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Appearance
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                Theme
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Choose Dark or Light (default: Light).
              </div>
            </div>

            <div className="inline-flex rounded-2xl border border-black/10 bg-white/60 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={
                  "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                  (themeMode === "dark"
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                }
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={
                  "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                  (themeMode === "light"
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-700 hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10")
                }
              >
                Light
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Savings graveyard
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">
                Gallery of wins (Ghost Cart)
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              Simulated market growth • ~
              {Math.round((ghostCart?.expectedAnnualReturn ?? 0.08) * 100)}%/yr
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Total life-wealth saved
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white tabular-nums">
                {formatMoneyWithCurrency(totalLifeWealthSaved, ghostCurrency)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Growth bonus
              </div>
              <div className="mt-1 text-lg font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatMoneyWithCurrency(growthBonus, ghostCurrency)}
              </div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Current ghost value
              </div>
              <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-white tabular-nums">
                {formatMoneyWithCurrency(currentGhostValue, ghostCurrency)}
              </div>
            </div>
          </div>

          {(ghostCart?.items?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl bg-black/5 p-4 text-sm text-zinc-700 dark:bg-white/5 dark:text-zinc-200">
              No ghosted items yet. Search an item and hit “Ghost It”.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3">
              {ghostCart!.items.map((it) => {
                const date = new Date(it.ghostedAt);
                const dateLabel = Number.isFinite(date.getTime())
                  ? new Intl.DateTimeFormat("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }).format(date)
                  : it.ghostedAt.slice(0, 10);

                return (
                  <div
                    key={it.id}
                    className="rounded-3xl border border-black/10 bg-white/60 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
                          <Image
                            src={it.imageUrl}
                            alt={it.title}
                            width={64}
                            height={64}
                            unoptimized
                            className="h-full w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {it.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="rounded-full border border-black/10 bg-white/60 px-2 py-0.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                              {it.category}
                            </span>
                            <span>{dateLabel}</span>
                            <span className="rounded-full border border-black/10 bg-white/60 px-2 py-0.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                              {it.priceMode}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <button
                          type="button"
                          onClick={() => onDeleteGhost(it.id)}
                          disabled={ghostBusyId === it.id}
                          className={
                            "rounded-xl px-3 py-2 text-xs font-semibold transition-colors " +
                            (ghostBusyId === it.id
                              ? "bg-black/5 text-zinc-500 dark:bg-white/10 dark:text-zinc-300"
                              : "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10")
                          }
                        >
                          {ghostBusyId === it.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Original price
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          {formatMoneyWithCurrency(it.price, ghostCurrency)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Current “ghost” value
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          {formatMoneyWithCurrency(
                            it.investedValue,
                            ghostCurrency,
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-300 tabular-nums">
                          +{formatMoneyWithCurrency(it.growth, ghostCurrency)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/5">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Freedom impact
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white tabular-nums">
                          {Number.isFinite(it.retirementDays)
                            ? `${it.retirementDays.toFixed(1)} days`
                            : "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                          Saved work: {formatWorkTime(it.workHoursSaved)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
