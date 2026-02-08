"use server";

import { db } from "@/db";
import { expenses, paychecks, subscriptions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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