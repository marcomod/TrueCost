"use server";

import { db } from "@/db";
import {
  expenses,
  ghostCartItems,
  sessions,
  subscriptions,
  userSettings,
  users,
} from "@/db/schema";
import type { PayFrequency } from "@/lib/contracts";
import { and, desc, eq, gte } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "node:crypto";

const DEMO_USER_ID = "demo-user";
const SESSION_COOKIE = "tc_session";
const SESSION_TTL_DAYS = 30;
const SEED_DEMO_SUBSCRIPTIONS = process.env.TC_SEED_DEMO_SUBSCRIPTIONS === "1";

type CurrencyCode = "CAD" | "USD";

type Settings = {
  hourlyWage: number;
  payFrequency: PayFrequency;
  currency: CurrencyCode;
  expectedAnnualReturn: number; // 0.08 = 8%
  jobSatisfaction: number; // 1..10
};

const DEFAULT_SETTINGS: Settings = {
  hourlyWage: 30,
  payFrequency: "biweekly",
  currency: "CAD",
  expectedAnnualReturn: 0.08,
  jobSatisfaction: 7,
};

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeStressMultiplier(jobSatisfaction: number) {
  const s = clamp(Math.round(jobSatisfaction), 1, 10);
  // 10 = loves job (no penalty), 1 = hates job (work time feels heavier).
  return 1 + (10 - s) * 0.1; // 1.0 .. 1.9
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [algo, saltB64, keyB64] = parts;
  if (algo !== "scrypt") return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function computeIncomeThisPeriod(settings: Settings) {
  const hourly = settings.hourlyWage;
  const hours =
    settings.payFrequency === "weekly"
      ? 40
      : settings.payFrequency === "biweekly"
        ? 80
        : 160; // monthly (simple hackathon assumption)
  return hourly * hours;
}

async function ensureDemoUser() {
  const existing = await db.select().from(users).where(eq(users.id, DEMO_USER_ID)).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({
      id: DEMO_USER_ID,
      name: "Demo User",
      email: null,
      passwordHash: null,
      createdAt: now(),
    });
  }

  const s = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, DEMO_USER_ID))
    .limit(1);
  if (s.length === 0) {
    await db.insert(userSettings).values({
      userId: DEMO_USER_ID,
      hourlyWage: DEFAULT_SETTINGS.hourlyWage,
      payFrequency: DEFAULT_SETTINGS.payFrequency,
      currency: DEFAULT_SETTINGS.currency,
      expectedAnnualReturn: DEFAULT_SETTINGS.expectedAnnualReturn,
      inflationAdjusted: 0,
      jobSatisfaction: DEFAULT_SETTINGS.jobSatisfaction,
      updatedAt: now(),
    });
  }
}

async function getCurrentUserId() {
  await ensureDemoUser();

  const cookieJar = await cookies();
  const sessionId = cookieJar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return DEMO_USER_ID;

  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  const s = rows[0];
  if (!s) {
    cookieJar.delete(SESSION_COOKIE);
    return DEMO_USER_ID;
  }

  const expiresAt = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt as unknown as number);
  if (expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    cookieJar.delete(SESSION_COOKIE);
    return DEMO_USER_ID;
  }

  return s.userId;
}

async function getSettings(userId: string): Promise<Settings> {
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    await db.insert(userSettings).values({
      userId,
      hourlyWage: DEFAULT_SETTINGS.hourlyWage,
      payFrequency: DEFAULT_SETTINGS.payFrequency,
      currency: DEFAULT_SETTINGS.currency,
      expectedAnnualReturn: DEFAULT_SETTINGS.expectedAnnualReturn,
      inflationAdjusted: 0,
      jobSatisfaction: DEFAULT_SETTINGS.jobSatisfaction,
      updatedAt: now(),
    });
    return { ...DEFAULT_SETTINGS };
  }

  return {
    hourlyWage: row.hourlyWage ?? DEFAULT_SETTINGS.hourlyWage,
    payFrequency: (row.payFrequency as PayFrequency) ?? DEFAULT_SETTINGS.payFrequency,
    currency: (row.currency as CurrencyCode) ?? DEFAULT_SETTINGS.currency,
    expectedAnnualReturn:
      row.expectedAnnualReturn ?? DEFAULT_SETTINGS.expectedAnnualReturn,
    jobSatisfaction:
      row.jobSatisfaction != null
        ? clamp(Number(row.jobSatisfaction), 1, 10)
        : DEFAULT_SETTINGS.jobSatisfaction,
  };
}

async function setSessionCookie(sessionId: string, expires: Date) {
  const cookieJar = await cookies();
  cookieJar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function signOut() {
  const cookieJar = await cookies();
  const sessionId = cookieJar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  cookieJar.delete(SESSION_COOKIE);
}

export async function ensureDemoSubscriptions() {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, DEMO_USER_ID))
    .limit(1);

  if (existing.length > 0) return;

  const today = new Date();
  const nextBilling = isoDate(addDays(today, 14));

  await db.insert(subscriptions).values([
    {
      id: makeId("sub"),
      userId: DEMO_USER_ID,
      name: "Spotify Premium",
      amount: 11.99,
      cadence: "monthly",
      nextBillingDate: nextBilling,
      createdAt: addDays(today, -120),
    },
    {
      id: makeId("sub"),
      userId: DEMO_USER_ID,
      name: "Netflix",
      amount: 15.49,
      cadence: "monthly",
      nextBillingDate: nextBilling,
      createdAt: addDays(today, -210),
    },
    {
      id: makeId("sub"),
      userId: DEMO_USER_ID,
      name: "iCloud Storage",
      amount: 2.99,
      cadence: "monthly",
      nextBillingDate: nextBilling,
      createdAt: addDays(today, -365),
    },
  ]);
}

export async function addExpense(input: {
  amount: number;
  category: string;
  date: string; // "YYYY-MM-DD"
  note?: string;
}) {
  const userId = await getCurrentUserId();
  await db.insert(expenses).values({
    id: makeId("exp"),
    userId,
    amount: input.amount,
    category: input.category,
    date: input.date,
    note: input.note ?? null,
    createdAt: now(),
  });

  // Dashboard adds "subscriptions" as an expense category.
  // To make Insights reflect what the user adds in Dashboard, we also upsert a
  // subscription row when category === "subscriptions".
  if (input.category === "subscriptions") {
    const name = (input.note ?? "").trim();
    // Avoid creating confusing placeholder subscriptions if the note is blank.
    // Users can always add a subscription directly in Insights.
    if (!name) return;
    const noteLower = name.toLowerCase();
    const cadence: "monthly" | "yearly" =
      noteLower.includes("yearly") ||
      noteLower.includes("annual") ||
      noteLower.includes("/yr") ||
      noteLower.includes("per year")
        ? "yearly"
        : "monthly";

    const dt = new Date(`${input.date}T00:00:00`);
    const createdAt = Number.isFinite(dt.getTime()) ? dt : now();
    const nextBillingDate = (() => {
      if (!Number.isFinite(createdAt.getTime())) return null;
      const next = new Date(createdAt);
      next.setMonth(next.getMonth() + (cadence === "yearly" ? 12 : 1));
      return isoDate(next);
    })();

    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.name, name)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(subscriptions)
        .set({
          amount: input.amount,
          cadence,
          nextBillingDate,
        })
        .where(and(eq(subscriptions.userId, userId), eq(subscriptions.name, name)));
    } else {
      await db.insert(subscriptions).values({
        id: makeId("sub"),
        userId,
        name,
        amount: input.amount,
        cadence,
        nextBillingDate,
        createdAt,
      });
    }
  }
}

export async function deleteExpense(expenseId: string) {
  if (!expenseId) return;
  const userId = await getCurrentUserId();
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)));
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function monthsBetween(a: Date, b = new Date()) {
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

function simulateInvestedValue({
  principal,
  annualRate,
  from,
  to = new Date(),
}: {
  principal: number;
  annualRate: number;
  from: Date;
  to?: Date;
}) {
  const m = monthsBetween(from, to);
  const r = annualRate / 12;
  return principal * Math.pow(1 + r, m);
}

export async function getInsightsData() {
  const userId = await getCurrentUserId();
  const settings = await getSettings(userId);
  const income = computeIncomeThisPeriod(settings);

  const today = new Date();
  const last30Start = isoDate(addDays(today, -29));
  const last7Start = isoDate(addDays(today, -6));
  const prev7Start = isoDate(addDays(today, -13));

  const last30Rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), gte(expenses.date, last30Start)))
    .orderBy(desc(expenses.date))
    .limit(500);

  const spent30 = last30Rows.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const dailyTotalsLast7: { date: string; total: number }[] = [];
  const totalsByDate: Record<string, number> = {};
  for (const e of last30Rows) {
    totalsByDate[e.date] = (totalsByDate[e.date] ?? 0) + (e.amount ?? 0);
  }

  for (let i = 6; i >= 0; i -= 1) {
    const date = isoDate(addDays(today, -i));
    dailyTotalsLast7.push({ date, total: totalsByDate[date] ?? 0 });
  }

  const dailyTotalsPrev7: { date: string; total: number }[] = [];
  for (let i = 13; i >= 7; i -= 1) {
    const date = isoDate(addDays(today, -i));
    dailyTotalsPrev7.push({ date, total: totalsByDate[date] ?? 0 });
  }

  let weekendTotal = 0;
  let weekendDays = 0;
  let weekdayTotal = 0;
  let weekdayDays = 0;

  for (let i = 29; i >= 0; i -= 1) {
    const date = isoDate(addDays(today, -i));
    const dt = new Date(`${date}T00:00:00`);
    const dow = dt.getDay(); // 0=Sun ... 6=Sat
    const total = totalsByDate[date] ?? 0;
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend) {
      weekendTotal += total;
      weekendDays += 1;
    } else {
      weekdayTotal += total;
      weekdayDays += 1;
    }
  }

  const weekendAvg = weekendDays > 0 ? weekendTotal / weekendDays : 0;
  const weekdayAvg = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0;

  return {
    userId,
    income,
    currency: settings.currency,
    hourlyWage: settings.hourlyWage,
    jobSatisfaction: settings.jobSatisfaction,
    stressMultiplier: computeStressMultiplier(settings.jobSatisfaction),
    spent30,
    remaining: Math.max(income - spent30, 0),
    dailyTotalsLast7,
    dailyTotalsPrev7,
    weekendAvg,
    weekdayAvg,
    last7Start,
    prev7Start,
  };
}

export async function addSubscription(input: {
  name: string;
  amount: number;
  cadence: "monthly" | "yearly";
  nextBillingDate?: string;
}) {
  const userId = await getCurrentUserId();
  await db.insert(subscriptions).values({
    id: makeId("sub"),
    userId,
    name: input.name,
    amount: input.amount,
    cadence: input.cadence,
    nextBillingDate: input.nextBillingDate ?? null,
    createdAt: now(),
  });
}

export async function listSubscriptions() {
  const userId = await getCurrentUserId();
  if (userId === DEMO_USER_ID && SEED_DEMO_SUBSCRIPTIONS)
    await ensureDemoSubscriptions();

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(50);

  const filteredRows =
    userId === DEMO_USER_ID && !SEED_DEMO_SUBSCRIPTIONS
      ? rows.filter((r) => !isDemoSeedSubscriptionRow(r))
      : rows;

  return filteredRows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount ?? 0,
    cadence: r.cadence as "monthly" | "yearly",
    nextBillingDate: r.nextBillingDate ?? null,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

function isDemoSeedSubscriptionRow(row: {
  name: string;
  amount: number;
  cadence: string;
}) {
  const demoSeeds = [
    { name: "Spotify Premium", amount: 11.99, cadence: "monthly" },
    { name: "Netflix", amount: 15.49, cadence: "monthly" },
    { name: "iCloud Storage", amount: 2.99, cadence: "monthly" },
  ] as const;

  return demoSeeds.some(
    (seed) =>
      row.name === seed.name &&
      row.cadence === seed.cadence &&
      Math.abs((row.amount ?? 0) - seed.amount) < 0.0001,
  );
}

export async function getSubscriptionDangerData() {
  const userId = await getCurrentUserId();
  const settings = await getSettings(userId);
  const subs = await listSubscriptions();
  const income = computeIncomeThisPeriod(settings);
  return {
    userId,
    income,
    currency: settings.currency,
    hourlyWage: settings.hourlyWage,
    jobSatisfaction: settings.jobSatisfaction,
    stressMultiplier: computeStressMultiplier(settings.jobSatisfaction),
    expectedAnnualReturn: settings.expectedAnnualReturn,
    subscriptions: subs,
  };
}

export async function deleteSubscription(subscriptionId: string) {
  if (!subscriptionId) return;
  const userId = await getCurrentUserId();
  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)));
}

export async function getDashboardSummary() {
  const userId = await getCurrentUserId();
  const settings = await getSettings(userId);
  const income = computeIncomeThisPeriod(settings);

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.date))
    .limit(10);

  const spent = expenseRows.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const categoryTotals: Record<string, number> = {};
  for (const e of expenseRows) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + (e.amount ?? 0);
  }

  const remaining = income - spent;

  return {
    userId,
    income,
    currency: settings.currency,
    hourlyWage: settings.hourlyWage,
    jobSatisfaction: settings.jobSatisfaction,
    stressMultiplier: computeStressMultiplier(settings.jobSatisfaction),
    payFrequency: settings.payFrequency,
    spent,
    remaining,
    categoryTotals,
    recentExpenses: expenseRows,
  };
}

export async function getMyProfile() {
  const userId = await getCurrentUserId();
  const settings = await getSettings(userId);

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0] ?? null;

  return {
    isDemo: userId === DEMO_USER_ID,
    user: u
      ? { id: u.id, name: u.name ?? "", email: u.email ?? null }
      : { id: userId, name: "", email: null },
    settings,
  };
}

export async function updateMySettings(input: Partial<Settings>) {
  const userId = await getCurrentUserId();
  const current = await getSettings(userId);

  const next: Settings = {
    hourlyWage:
      input.hourlyWage != null
        ? clamp(Number(input.hourlyWage), 0, 10_000)
        : current.hourlyWage,
    payFrequency: (input.payFrequency as PayFrequency) ?? current.payFrequency,
    currency: (input.currency as CurrencyCode) ?? current.currency,
    expectedAnnualReturn:
      input.expectedAnnualReturn != null
        ? clamp(Number(input.expectedAnnualReturn), 0, 1)
        : current.expectedAnnualReturn,
    jobSatisfaction:
      input.jobSatisfaction != null
        ? clamp(Number(input.jobSatisfaction), 1, 10)
        : current.jobSatisfaction,
  };

  await db
    .insert(userSettings)
    .values({
      userId,
      hourlyWage: next.hourlyWage,
      payFrequency: next.payFrequency,
      currency: next.currency,
      expectedAnnualReturn: next.expectedAnnualReturn,
      inflationAdjusted: 0,
      jobSatisfaction: next.jobSatisfaction,
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        hourlyWage: next.hourlyWage,
        payFrequency: next.payFrequency,
        currency: next.currency,
        expectedAnnualReturn: next.expectedAnnualReturn,
        inflationAdjusted: 0,
        jobSatisfaction: next.jobSatisfaction,
        updatedAt: now(),
      },
    });

  return next;
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!name) return { ok: false as const, error: "Name is required." };
  if (!email.includes("@")) return { ok: false as const, error: "Invalid email." };
  if (password.length < 8)
    return { ok: false as const, error: "Password must be at least 8 characters." };

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0)
    return { ok: false as const, error: "Email already in use. Try signing in." };

  const userId = makeId("usr");
  const passwordHash = hashPassword(password);

  await db.insert(users).values({
    id: userId,
    name,
    email,
    passwordHash,
    createdAt: now(),
  });

  await db.insert(userSettings).values({
    userId,
    hourlyWage: DEFAULT_SETTINGS.hourlyWage,
    payFrequency: DEFAULT_SETTINGS.payFrequency,
    currency: DEFAULT_SETTINGS.currency,
    expectedAnnualReturn: DEFAULT_SETTINGS.expectedAnnualReturn,
    inflationAdjusted: 0,
    jobSatisfaction: DEFAULT_SETTINGS.jobSatisfaction,
    updatedAt: now(),
  });

  const sessionId = makeId("sess");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    createdAt: now(),
    expiresAt: expires,
  });
  await setSessionCookie(sessionId, expires);

  return { ok: true as const };
}

export async function signIn(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const u = rows[0];
  if (!u || !u.passwordHash)
    return { ok: false as const, error: "Invalid email or password." };

  if (!verifyPassword(password, u.passwordHash))
    return { ok: false as const, error: "Invalid email or password." };

  const sessionId = makeId("sess");
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: sessionId,
    userId: u.id,
    createdAt: now(),
    expiresAt: expires,
  });
  await setSessionCookie(sessionId, expires);

  return { ok: true as const };
}

export async function addGhostCartItem(input: {
  title: string;
  price: number;
  category: string;
  imageUrl: string;
  priceMode: "auto" | "manual";
  ghostedAt?: string; // ISO date (optional)
}) {
  const userId = await getCurrentUserId();
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false as const, error: "Title is required." };

  const price = clamp(Number(input.price), 0, 1_000_000);
  if (!Number.isFinite(price) || price <= 0)
    return { ok: false as const, error: "Price must be > 0." };

  const category = (input.category ?? "other").trim() || "other";
  const imageUrl = (input.imageUrl ?? "/placeholder.svg").trim() || "/placeholder.svg";
  const priceMode = input.priceMode === "manual" ? "manual" : "auto";

  const dt = input.ghostedAt ? new Date(input.ghostedAt) : now();
  const ghostedAt = Number.isFinite(dt.getTime()) ? dt : now();

  await db.insert(ghostCartItems).values({
    id: makeId("ghost"),
    userId,
    title,
    category,
    price,
    priceMode,
    imageUrl,
    ghostedAt,
  });

  return { ok: true as const };
}

export async function deleteGhostCartItem(itemId: string) {
  if (!itemId) return;
  const userId = await getCurrentUserId();
  await db
    .delete(ghostCartItems)
    .where(and(eq(ghostCartItems.id, itemId), eq(ghostCartItems.userId, userId)));
}

export async function getGhostCartData() {
  const userId = await getCurrentUserId();
  const settings = await getSettings(userId);

  const rows = await db
    .select()
    .from(ghostCartItems)
    .where(eq(ghostCartItems.userId, userId))
    .orderBy(desc(ghostCartItems.ghostedAt))
    .limit(100);

  const stressMultiplier = computeStressMultiplier(settings.jobSatisfaction);
  const hourlyWage = settings.hourlyWage;
  const currency = settings.currency;

  const items = rows.map((r) => {
    const ghostedAt =
      r.ghostedAt instanceof Date ? r.ghostedAt : new Date(r.ghostedAt as unknown as number);
    const investedValue = simulateInvestedValue({
      principal: r.price ?? 0,
      annualRate: settings.expectedAnnualReturn,
      from: ghostedAt,
      to: new Date(),
    });
    const growth = investedValue - (r.price ?? 0);
    const workHoursSaved =
      hourlyWage > 0 ? ((r.price ?? 0) / hourlyWage) * stressMultiplier : NaN;
    const retirementDays =
      hourlyWage > 0 ? investedValue / (hourlyWage * 8) : NaN;

    return {
      id: r.id,
      title: r.title ?? "",
      category: (r.category ?? "other") as string,
      price: r.price ?? 0,
      priceMode: (r.priceMode ?? "auto") as "auto" | "manual",
      imageUrl: r.imageUrl ?? "/placeholder.svg",
      ghostedAt: ghostedAt.toISOString(),
      investedValue,
      growth,
      workHoursSaved,
      retirementDays,
    };
  });

  const originalTotal = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const currentTotal = items.reduce((sum, i) => sum + (i.investedValue ?? 0), 0);
  const growthBonus = currentTotal - originalTotal;

  return {
    userId,
    currency,
    hourlyWage,
    jobSatisfaction: settings.jobSatisfaction,
    stressMultiplier,
    expectedAnnualReturn: settings.expectedAnnualReturn,
    originalTotal,
    currentTotal,
    growthBonus,
    items,
  };
}
