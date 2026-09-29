import { z } from "zod";

export const ReviewIssueSchema = z.object({
  claim: z.string(),
  reason: z.string(),
  expectedFact: z.string().nullable(),
});

export const ReviewResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(ReviewIssueSchema),
});

export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
