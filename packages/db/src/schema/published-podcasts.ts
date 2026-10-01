import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { stepVersions } from "./step-versions";
import { workflowRuns } from "./workflow-runs";

/**
 * Bản ghi xuất bản độc lập, tách khỏi trạng thái chạy: chỉ sinh ra khi
 * Moderator phê duyệt ở Gate 2, gắn cứng vào node kịch bản đã duyệt.
 */
export const publishedPodcasts = pgTable("published_podcasts", {
  id: serial("id").primaryKey(),
  workflowRunId: integer("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id, { onDelete: "cascade" }),
  approvedVersionId: integer("approved_version_id")
    .notNull()
    .references(() => stepVersions.id, { onDelete: "cascade" }),
  approvedBy: text("approved_by").notNull().default("Moderator"),
  finalScript: text("final_script").notNull(),
  wordCount: integer("word_count").notNull(),
  estimatedDurationSeconds: integer("estimated_duration_seconds").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

export type PublishedPodcast = typeof publishedPodcasts.$inferSelect;
export type NewPublishedPodcast = typeof publishedPodcasts.$inferInsert;
