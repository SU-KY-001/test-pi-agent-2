import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workflowRuns = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  rawProductText: text("raw_product_text").notNull(),
  status: text("status").notNull().default("PENDING"),
  currentStep: text("current_step"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
