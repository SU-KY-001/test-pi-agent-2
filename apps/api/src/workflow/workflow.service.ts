import {
  AdvertisementSchema,
  ContentPlanSchema,
  ProductDataSchema,
  ReviewResultSchema,
  type Advertisement,
  type ContentPlan,
  type ProductData,
  type ReviewResult,
} from "@repo/contracts";
import {
  getStepVersion,
  getWorkflowStep,
  insertStepVersion,
} from "./workflow.repository";

export const STEP_OUTPUT_SCHEMAS = {
  EXTRACTOR: ProductDataSchema,
  PLANNER: ContentPlanSchema,
  WRITER: AdvertisementSchema,
  REVIEWER: ReviewResultSchema,
} as const;

export type StepOutputMap = {
  EXTRACTOR: ProductData;
  PLANNER: ContentPlan;
  WRITER: Advertisement;
  REVIEWER: ReviewResult;
};

/** Why: Writer must only run on human-approved Planner output, never latest draft. */
export async function loadApprovedPlannerOutput(
  workflowRunId: number
): Promise<{ stepId: number; version: number; plan: ContentPlan }> {
  const planner = await getWorkflowStep(workflowRunId, "PLANNER");
  if (!planner || planner.approvedVersion == null) {
    throw new Error("Planner has no approved version");
  }
  const row = await getStepVersion(planner.id, planner.approvedVersion);
  if (!row) throw new Error(`Approved Planner v${planner.approvedVersion} not found`);
  return {
    stepId: planner.id,
    version: planner.approvedVersion,
    plan: ContentPlanSchema.parse(row.outputJson),
  };
}

export async function loadLatestStepOutput(
  workflowRunId: number,
  stepType: "EXTRACTOR"
): Promise<ProductData>;
export async function loadLatestStepOutput(
  workflowRunId: number,
  stepType: "PLANNER"
): Promise<ContentPlan>;
export async function loadLatestStepOutput(
  workflowRunId: number,
  stepType: "WRITER"
): Promise<Advertisement>;
export async function loadLatestStepOutput(
  workflowRunId: number,
  stepType: "REVIEWER"
): Promise<ReviewResult>;
export async function loadLatestStepOutput(
  workflowRunId: number,
  stepType: keyof StepOutputMap
): Promise<StepOutputMap[keyof StepOutputMap]> {
  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step || step.currentVersion == null) {
    throw new Error(`Step ${stepType} has no completed version`);
  }
  const row = await getStepVersion(step.id, step.currentVersion);
  if (!row) throw new Error(`Step ${stepType} v${step.currentVersion} not found`);
  return STEP_OUTPUT_SCHEMAS[stepType].parse(row.outputJson);
}

/** Why: version rows are append-only; regen bumps current_version without touching v1. */
export async function saveNextStepVersion<T extends keyof StepOutputMap>(
  workflowRunId: number,
  stepType: T,
  input: unknown,
  output: StepOutputMap[T],
  humanFeedback?: string | null
) {
  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step) throw new Error(`Step ${stepType} not found`);
  const nextVersion = (step.currentVersion ?? 0) + 1;
  return insertStepVersion({
    workflowStepId: step.id,
    version: nextVersion,
    inputJson: input,
    outputJson: output,
    humanFeedback: humanFeedback ?? null,
  });
}
