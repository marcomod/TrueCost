"use server";

import { db } from "@/db";
import { expenses, paychecks, subscriptions } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

const DEMO_USER_ID = "demo-user";

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function ensureDemoPaycheck() {
  const existing = await db
    .select()
    .from(paychecks)
    .where(eq(paychecks.userId, DEMO_USER_ID))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(paychecks).values({
    id: makeId("pay"),
    userId: DEMO_USER_ID,
    amount: 1000,
    frequency: "biweekly",
    startDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date(),
  });
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
  await db.insert(expenses).values({
    id: makeId("exp"),
    userId: DEMO_USER_ID,
    amount: input.amount,
    category: input.category,
    date: input.date,
    note: input.note ?? null,
    createdAt: new Date(),
  });
}

export async function deleteExpense(expenseId: string) {
  if (!expenseId) return;
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.userId, DEMO_USER_ID)));
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export async function getInsightsData() {
  await ensureDemoPaycheck();

  const paycheckRows = await db
    .select()
    .from(paychecks)
    .where(eq(paychecks.userId, DEMO_USER_ID))
    .orderBy(desc(paychecks.createdAt))
    .limit(1);

  const income = paycheckRows[0]?.amount ?? 0;

  const today = new Date();
  const last30Start = isoDate(addDays(today, -29));
  const last7Start = isoDate(addDays(today, -6));

  const last30Rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, DEMO_USER_ID), gte(expenses.date, last30Start)))
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
    income,
    spent30,
    remaining: Math.max(income - spent30, 0),
    dailyTotalsLast7,
    weekendAvg,
    weekdayAvg,
    last7Start,
  };
}

export async function addSubscription(input: {
  name: string;
  amount: number;
  cadence: "monthly" | "yearly";
  nextBillingDate?: string;
}) {
  await db.insert(subscriptions).values({
    id: makeId("sub"),
    userId: DEMO_USER_ID,
    name: input.name,
    amount: input.amount,
    cadence: input.cadence,
    nextBillingDate: input.nextBillingDate ?? null,
    createdAt: new Date(),
  });
}

export async function listSubscriptions() {
  await ensureDemoSubscriptions();

  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, DEMO_USER_ID))
    .orderBy(desc(subscriptions.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: r.amount ?? 0,
    cadence: r.cadence as "monthly" | "yearly",
    nextBillingDate: r.nextBillingDate ?? null,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

export async function getSubscriptionDangerData() {
  await ensureDemoPaycheck();
  const subs = await listSubscriptions();

  const paycheckRows = await db
    .select()
    .from(paychecks)
    .where(eq(paychecks.userId, DEMO_USER_ID))
    .orderBy(desc(paychecks.createdAt))
    .limit(1);
  const income = paycheckRows[0]?.amount ?? 0;

  return { income, subscriptions: subs };
}

export async function getDashboardSummary() {
  await ensureDemoPaycheck();

  const paycheckRows = await db
    .select()
    .from(paychecks)
    .where(eq(paychecks.userId, DEMO_USER_ID))
    .orderBy(desc(paychecks.createdAt))
    .limit(1);

  const income = paycheckRows[0]?.amount ?? 0;

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, DEMO_USER_ID))
    .orderBy(desc(expenses.date))
    .limit(10);

  const spent = expenseRows.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const categoryTotals: Record<string, number> = {};
  for (const e of expenseRows) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + (e.amount ?? 0);
  }

  const remaining = income - spent;

  return {
    income,
    spent,
    remaining,
    categoryTotals,
    recentExpenses: expenseRows,
  };
}
