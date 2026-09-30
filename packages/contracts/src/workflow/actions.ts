import { z } from "zod";

export const RerunStepRequestSchema = z.object({
  feedback: z.string().min(1),
});

export type RerunStepRequest = z.infer<typeof RerunStepRequestSchema>;

export const ContinueStepRequestSchema = z.object({
  version: z.number().int().positive(),
  incomingGuidance: z.string().optional(),
});

export type ContinueStepRequest = z.infer<typeof ContinueStepRequestSchema>;

export const DirectEditStepRequestSchema = z.object({
  baseVersion: z.number().int().positive(),
  editedOutputJson: z.unknown(),
  note: z.string().optional(),
});

export type DirectEditStepRequest = z.infer<typeof DirectEditStepRequestSchema>;
