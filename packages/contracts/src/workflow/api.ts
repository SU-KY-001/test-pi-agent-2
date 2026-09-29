import { z } from "zod";

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
]);

export const StepTypeSchema = z.enum([
  "EXTRACTOR",
  "PLANNER",
  "WRITER",
  "REVIEWER",
]);

export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
export type StepStatus = z.infer<typeof StepStatusSchema>;
export type StepType = z.infer<typeof StepTypeSchema>;

export const CreateWorkflowRequestSchema = z.object({
  rawProductText: z.string().min(1),
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
  version: z.number().int().positive(),
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
  currentVersion: z.number().int().positive().nullable(),
  approvedVersion: z.number().int().positive().nullable(),
  errorMessage: z.string().nullable(),
  versions: z.array(StepVersionSchema),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const GetWorkflowResponseSchema = z.object({
  id: z.number(),
  status: WorkflowStatusSchema,
  rawProductText: z.string(),
  currentStep: StepTypeSchema.nullable(),
  steps: z.array(WorkflowStepSchema),
});

export type GetWorkflowResponse = z.infer<typeof GetWorkflowResponseSchema>;
