import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
});

export const paychecks = sqliteTable("paychecks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: real("amount").notNull(),
  frequency: text("frequency").notNull(), // "weekly" | "biweekly" | "monthly"
  startDate: text("start_date").notNull(), // ISO date
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});