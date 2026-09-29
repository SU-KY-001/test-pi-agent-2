import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { workflowSteps } from "./workflow-steps";

export const stepVersions = pgTable("step_versions", {
  id: serial("id").primaryKey(),
  workflowStepId: integer("workflow_step_id")
    .notNull()
    .references(() => workflowSteps.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json").notNull(),
  humanFeedback: text("human_feedback"),
  validationStatus: text("validation_status").notNull().default("valid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StepVersion = typeof stepVersions.$inferSelect;
export type NewStepVersion = typeof stepVersions.$inferInsert;
