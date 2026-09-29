import { z } from "zod";

export const WorkflowEventSchema = z.object({
  id: z.number().int().positive(),
  type: z.string().min(1),
  message: z.string(),
  metadataJson: z.unknown(),
  createdAt: z.string(),
});

export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const GetWorkflowEventsResponseSchema = z.object({
  workflowRunId: z.number().int().positive(),
  count: z.number().int().nonnegative(),
  events: z.array(WorkflowEventSchema),
});

export type GetWorkflowEventsResponse = z.infer<typeof GetWorkflowEventsResponseSchema>;
