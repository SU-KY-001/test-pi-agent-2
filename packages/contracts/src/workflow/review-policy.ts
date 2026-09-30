import { z } from "zod";
import type { StepType } from "./api";

export const ReviewPolicySchema = z.enum(["AUTO_CONTINUE", "REVIEW_REQUIRED"]);

export type ReviewPolicy = z.infer<typeof ReviewPolicySchema>;

export const STEP_REVIEW_POLICY: Record<StepType, ReviewPolicy> = {
  EXTRACTOR: "AUTO_CONTINUE",
  PLANNER: "REVIEW_REQUIRED",
  WRITER: "REVIEW_REQUIRED",
  REVIEWER: "AUTO_CONTINUE",
} as const;
