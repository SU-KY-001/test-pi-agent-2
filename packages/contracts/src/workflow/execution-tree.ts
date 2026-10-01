import { z } from "zod";
import { StepTypeSchema } from "./api";
import { NarrativeFocusSelectionSchema } from "./research-consultation";

/**
 * Node bất biến trong Cây Lịch sử Thực thi (Adjacency List).
 * `id`/`workflowRunId`/`parentVersionId` là khoá nội bộ của PGlite (`serial`),
 * KHÔNG phải uuid — xem deviation D1 trong phase-01 report.
 */
export const ExecutionNodeSchema = z.object({
  id: z.number().int().positive(),
  workflowRunId: z.number().int().positive(),
  stepType: StepTypeSchema,
  versionNumber: z.number().int().positive(),
  parentVersionId: z.number().int().positive().nullable(),
  status: z.enum(["PENDING", "QUEUED", "RUNNING", "WAITING_FOR_HUMAN", "COMPLETED", "FAILED"]),
  outputJson: z.unknown().nullable(),
  guidance: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const BranchLineageSchema = z.object({
  currentNodeId: z.number().int().positive().nullable(),
  ancestorNodes: z.array(ExecutionNodeSchema),
  /** Bước → output mới nhất trên nhánh tổ tiên, dùng để dựng ngữ cảnh cho agent. */
  predecessorOutputs: z.record(z.string(), z.unknown()),
});

export const ForkStepPayloadSchema = z.object({
  forkFromVersionId: z.number().int().positive(),
  feedbackOrGuidance: z.string().optional(),
  narrativeSelection: NarrativeFocusSelectionSchema.optional(),
});

export const PublicationRecordSchema = z.object({
  id: z.number().int().positive(),
  workflowRunId: z.number().int().positive(),
  approvedVersionId: z.number().int().positive(),
  approvedBy: z.string(),
  finalScript: z.string(),
  totalWords: z.number().int().nonnegative(),
  estimatedDurationSeconds: z.number().int().nonnegative(),
  publishedAt: z.string().datetime(),
});

export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;
export type BranchLineage = z.infer<typeof BranchLineageSchema>;
export type ForkStepPayload = z.infer<typeof ForkStepPayloadSchema>;
export type PublicationRecord = z.infer<typeof PublicationRecordSchema>;
