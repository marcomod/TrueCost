// ===============================
// CORE DATA TYPES
// ===============================

export type PayFrequency = "weekly" | "biweekly" | "monthly";

export type ExpenseCategory =
  | "food"
  | "rent"
  | "transport"
  | "subscriptions"
  | "shopping"
  | "other";

// -------------------------------
// DATABASE-LIKE OBJECT SHAPES
// -------------------------------

export interface Paycheck {
  id: string;
  userId: string;
  amount: number;
  frequency: PayFrequency;
  startDate: string; // ISO date string
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO date
  note?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: number;
  cadence: "monthly" | "yearly";
  nextBillingDate: string;
}

// -------------------------------
// DASHBOARD AGGREGATE RESPONSE
// -------------------------------

export interface DashboardSummary {
  incomeThisPeriod: number;
  spentThisPeriod: number;
  remainingThisPeriod: number;

  categoryTotals: {
    category: ExpenseCategory;
    total: number;
  }[];

  recentExpenses: Expense[];
}

// ===============================
// FRONTEND → BACKEND FUNCTION CONTRACTS
// ===============================

export interface AppAPI {
  getDashboardSummary: (userId: string) => Promise<DashboardSummary>;

  createPaycheck: (
    userId: string,
    data: Omit<Paycheck, "id" | "userId">,
  ) => Promise<void>;

  createExpense: (
    userId: string,
    data: Omit<Expense, "id" | "userId">,
  ) => Promise<void>;

  listExpenses: (userId: string) => Promise<Expense[]>;

  createSubscription: (
    userId: string,
    data: Omit<Subscription, "id" | "userId">,
  ) => Promise<void>;

  listSubscriptions: (userId: string) => Promise<Subscription[]>;
}
