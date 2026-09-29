import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { workflowRuns } from "./workflow-runs";

export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  workflowRunId: integer("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  stepType: text("step_type").notNull(),
  status: text("status").notNull().default("PENDING"),
  currentVersion: integer("current_version"),
  approvedVersion: integer("approved_version"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type NewWorkflowStep = typeof workflowSteps.$inferInsert;
