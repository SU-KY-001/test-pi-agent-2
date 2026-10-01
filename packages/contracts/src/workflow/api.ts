import { z } from "zod";
import { ResearchConsultationSchema } from "./research-consultation";
import { EvaluatedCorpusSchema } from "./evaluated-corpus";
import { ResearchPackSchema } from "./research-pack";
import { StoryOutlineSchema } from "./story-outline";
import { PodcastScriptDraftSchema } from "./podcast-script";
import { OralizedScriptSchema } from "./oralized-script";
import { ReviewReportSchema } from "./review-report";

/** Thứ tự thực thi tuyến tính của 7 tác tử Flow 2. */
export const STEP_TYPES = [
  "RESEARCHER",
  "SOURCE_EVALUATOR",
  "FACT_EXTRACTOR",
  "STORY_PLANNER",
  "SCRIPT_WRITER",
  "ORALIZER",
  "FACT_CHECKER",
] as const;

export const StepTypeSchema = z.enum(STEP_TYPES);
export type StepType = (typeof STEP_TYPES)[number];

/**
 * Ba trạm bắt buộc dừng chờ Moderator: sau Tư vấn biên tập (Gate 0),
 * sau Dàn ý SPDC (Gate 1), sau Kiểm định (Gate 2).
 */
export const HITL_GATED_STEPS = ["RESEARCHER", "STORY_PLANNER", "FACT_CHECKER"] as const;

export const STEP_ORDER: readonly StepType[] = STEP_TYPES;

export const STEP_OUTPUT_SCHEMAS = {
  RESEARCHER: ResearchConsultationSchema,
  SOURCE_EVALUATOR: EvaluatedCorpusSchema,
  FACT_EXTRACTOR: ResearchPackSchema,
  STORY_PLANNER: StoryOutlineSchema,
  SCRIPT_WRITER: PodcastScriptDraftSchema,
  ORALIZER: OralizedScriptSchema,
  FACT_CHECKER: ReviewReportSchema,
} as const;

export type StepPayloadMap = { [K in StepType]: z.infer<(typeof STEP_OUTPUT_SCHEMAS)[K]> };

export function isHitlGatedStep(stepType: StepType): boolean {
  return (HITL_GATED_STEPS as readonly StepType[]).includes(stepType);
}

export function nextStepType(stepType: StepType): StepType | null {
  const index = STEP_ORDER.indexOf(stepType);
  return index >= 0 && index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1]! : null;
}

export const WorkflowStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "WAITING_FOR_HUMAN",
  "COMPLETED",
  "FAILED",
]);

export const StepStatusSchema = z.enum([
  "PENDING",
  "QUEUED",
  "RUNNING",
  "WAITING_FOR_HUMAN",
  "COMPLETED",
  "FAILED",
  "STALE",
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const CreateWorkflowRequestSchema = z.object({
  topic: z.string().min(3),
  userProvidedSources: z.string().optional(),
});

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const CreateWorkflowResponseSchema = z.object({
  id: z.number().int().positive(),
});

export type CreateWorkflowResponse = z.infer<typeof CreateWorkflowResponseSchema>;

export const RegeneratePlannerRequestSchema = z.object({
  feedback: z.string().min(1),
});

export type RegeneratePlannerRequest = z.infer<typeof RegeneratePlannerRequestSchema>;

export const ApprovePlannerRequestSchema = z.object({
  version: z.number().int().positive(),
});

export type ApprovePlannerRequest = z.infer<typeof ApprovePlannerRequestSchema>;

export const StepVersionSchema = z.object({
  id: z.number().int().positive(),
  version: z.number().int().positive(),
  parentVersionId: z.number().int().positive().nullable(),
  inputJson: z.unknown(),
  outputJson: z.unknown(),
  humanFeedback: z.string().nullable(),
  validationStatus: z.enum(["valid", "invalid"]),
  createdAt: z.string(),
});

export type StepVersion = z.infer<typeof StepVersionSchema>;

export const WorkflowStepSchema = z.object({
  type: StepTypeSchema,
  status: StepStatusSchema,
  reviewPolicy: z.enum(["AUTO_CONTINUE", "REVIEW_REQUIRED"]),
  reviewer: z.string(),
  sortOrder: z.number().int(),
  currentVersion: z.number().int().positive().nullable(),
  approvedVersion: z.number().int().positive().nullable(),
  errorMessage: z.string().nullable(),
  incomingGuidance: z.string().nullable().optional(),
  versions: z.array(StepVersionSchema),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const GetWorkflowResponseSchema = z.object({
  id: z.number(),
  status: WorkflowStatusSchema,
  topic: z.string(),
  currentStep: StepTypeSchema.nullable(),
  steps: z.array(WorkflowStepSchema),
});

export type GetWorkflowResponse = z.infer<typeof GetWorkflowResponseSchema>;

export const WorkflowTreeResponseSchema = z.object({
  workflowRunId: z.number().int().positive(),
  nodes: z.array(
    z.object({
      id: z.number().int().positive(),
      stepType: StepTypeSchema,
      version: z.number().int().positive(),
      parentVersionId: z.number().int().positive().nullable(),
      status: StepStatusSchema,
      approved: z.boolean(),
      createdAt: z.string(),
    })
  ),
  publications: z.array(
    z.object({
      id: z.number().int().positive(),
      approvedVersionId: z.number().int().positive(),
      totalWords: z.number().int().nonnegative(),
      estimatedDurationSeconds: z.number().int().nonnegative(),
      publishedAt: z.string(),
    })
  ),
});

export type WorkflowTreeResponse = z.infer<typeof WorkflowTreeResponseSchema>;
