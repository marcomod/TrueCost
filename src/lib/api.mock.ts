import type {
  AppAPI,
  DashboardSummary,
  Expense,
  Subscription,
  Paycheck,
  ExpenseCategory,
} from "@/lib/contracts.ts";

// Use a stable demo user for now.
// Later, this becomes the real logged-in user id.
const DEMO_USER_ID = "demo-user";

// In-memory mock state (resets on refresh)
let mockPaycheck: Paycheck | null = {
  id: "pay_1",
  userId: DEMO_USER_ID,
  amount: 1200,
  frequency: "biweekly",
  startDate: new Date().toISOString().slice(0, 10),
};

let mockExpenses: Expense[] = [
  {
    id: "exp_1",
    userId: DEMO_USER_ID,
    amount: 7,
    category: "food",
    date: new Date().toISOString().slice(0, 10),
    note: "Coffee",
  },
  {
    id: "exp_2",
    userId: DEMO_USER_ID,
    amount: 14.5,
    category: "food",
    date: new Date().toISOString().slice(0, 10),
    note: "Lunch",
  },
  {
    id: "exp_3",
    userId: DEMO_USER_ID,
    amount: 11.25,
    category: "transport",
    date: new Date().toISOString().slice(0, 10),
    note: "Uber",
  },
];

let mockSubscriptions: Subscription[] = [
  {
    id: "sub_1",
    userId: DEMO_USER_ID,
    name: "Spotify",
    amount: 11.99,
    cadence: "monthly",
    nextBillingDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: "sub_2",
    userId: DEMO_USER_ID,
    name: "Netflix",
    amount: 16.99,
    cadence: "monthly",
    nextBillingDate: new Date().toISOString().slice(0, 10),
  },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function sumByCategory(expenses: Expense[]) {
  const categories: ExpenseCategory[] = [
    "food",
    "rent",
    "transport",
    "subscriptions",
    "shopping",
    "other",
  ];

  return categories.map((category) => ({
    category,
    total: expenses
      .filter((e) => e.category === category)
      .reduce((acc, e) => acc + e.amount, 0),
  }));
}

function totalSpent(expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + e.amount, 0);
}

export const mockApi: AppAPI = {
  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    await sleep(250);

    const expenses = mockExpenses.filter((e) => e.userId === userId);
    const spent = totalSpent(expenses);
    const income = mockPaycheck?.userId === userId ? mockPaycheck.amount : 0;

    return {
      incomeThisPeriod: income,
      spentThisPeriod: spent,
      remainingThisPeriod: Math.max(income - spent, 0),
      categoryTotals: sumByCategory(expenses),
      recentExpenses: [...expenses].slice(-8).reverse(),
    };
  },

  async createPaycheck(
    userId: string,
    data: Omit<Paycheck, "id" | "userId">,
  ): Promise<void> {
    await sleep(250);

    mockPaycheck = {
      id: "pay_" + Math.random().toString(36).slice(2),
      userId,
      ...data,
    };
  },

  async createExpense(
    userId: string,
    data: Omit<Expense, "id" | "userId">,
  ): Promise<void> {
    await sleep(150);

    const newExpense: Expense = {
      id: "exp_" + Math.random().toString(36).slice(2),
      userId,
      ...data,
    };

    mockExpenses = [newExpense, ...mockExpenses];
  },

  async listExpenses(userId: string): Promise<Expense[]> {
    await sleep(200);
    return mockExpenses.filter((e) => e.userId === userId);
  },

  async createSubscription(
    userId: string,
    data: Omit<Subscription, "id" | "userId">,
  ): Promise<void> {
    await sleep(150);

    const newSub: Subscription = {
      id: "sub_" + Math.random().toString(36).slice(2),
      userId,
      ...data,
    };

    mockSubscriptions = [newSub, ...mockSubscriptions];
  },

  async listSubscriptions(userId: string): Promise<Subscription[]> {
    await sleep(200);
    return mockSubscriptions.filter((s) => s.userId === userId);
  },
};

// Optional: export this for convenience in UI during hackathon
export const DEMO_USER = { id: DEMO_USER_ID };
