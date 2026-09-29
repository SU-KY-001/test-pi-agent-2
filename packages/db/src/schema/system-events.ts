import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { workflowRuns } from "./workflow-runs";

export const systemEvents = pgTable("system_events", {
  id: serial("id").primaryKey(),
  workflowRunId: integer("workflow_run_id").references(() => workflowRuns.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SystemEvent = typeof systemEvents.$inferSelect;
export type NewSystemEvent = typeof systemEvents.$inferInsert;
