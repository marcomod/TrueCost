import {
  sqliteTable,
  text,
  real,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email"),
    passwordHash: text("password_hash"),
    createdAt: integer("created_at", { mode: "timestamp" }),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
  }),
);

export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id").primaryKey(),
  hourlyWage: real("hourly_wage").notNull(),
  payFrequency: text("pay_frequency").notNull(), // "weekly" | "biweekly" | "monthly"
  currency: text("currency").notNull(), // "CAD" | "USD"
  expectedAnnualReturn: real("expected_annual_return").notNull(), // 0.08 = 8%
  inflationAdjusted: integer("inflation_adjusted").notNull(), // 0/1
  jobSatisfaction: integer("job_satisfaction").notNull().default(7), // 1..10
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const paychecks = sqliteTable("paychecks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  frequency: text("frequency").notNull(), // "weekly" | "biweekly" | "monthly"
  startDate: text("start_date").notNull(), // ISO date
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  date: text("date").notNull(), // ISO date "YYYY-MM-DD"
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  cadence: text("cadence").notNull(), // "monthly" | "yearly"
  nextBillingDate: text("next_billing_date"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ghostCartItems = sqliteTable("ghost_cart_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull(),
  priceMode: text("price_mode").notNull(), // "auto" | "manual"
  imageUrl: text("image_url").notNull(),
  ghostedAt: integer("ghosted_at", { mode: "timestamp" }).notNull(),
});
