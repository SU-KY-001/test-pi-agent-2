import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { workflowSteps } from "./workflow-steps";

/**
 * Cây Lịch sử Thực thi (Adjacency List kiểu commit graph).
 * `parent_version_id` trỏ về node cha cùng nhánh; NULL = node gốc của run.
 * Bản ghi là bất biến: mọi lần chạy/fork sinh node mới, không sửa node cũ.
 */
export const stepVersions = pgTable("step_versions", {
  id: serial("id").primaryKey(),
  workflowStepId: integer("workflow_step_id")
    .notNull()
    .references(() => workflowSteps.id, { onDelete: "cascade" }),
  parentVersionId: integer("parent_version_id").references((): AnyPgColumn => stepVersions.id, {
    onDelete: "set null",
  }),
  version: integer("version").notNull(),
  inputJson: jsonb("input_json"),
  outputJson: jsonb("output_json").notNull(),
  humanFeedback: text("human_feedback"),
  validationStatus: text("validation_status").notNull().default("valid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type StepVersion = typeof stepVersions.$inferSelect;
export type NewStepVersion = typeof stepVersions.$inferInsert;
