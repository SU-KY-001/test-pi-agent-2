import { z } from "zod";

export const ContentPlanSchema = z.object({
  targetAudience: z.string().min(1),
  angle: z.string().min(1),
  headlineDirection: z.string().min(1),
  keyPoints: z.array(z.string()).min(2).max(4),
  tone: z.enum(["friendly", "professional", "energetic", "minimal"]),
});

export type ContentPlan = z.infer<typeof ContentPlanSchema>;
