import {
  ReviewResultSchema,
  type Advertisement,
  type ProductData,
  type ReviewResult,
} from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import { REVIEWER_SYSTEM_PROMPT, buildReviewerPrompt } from "./prompts";

export async function runReviewerAgent(
  productData: ProductData,
  advertisement: Advertisement,
  workflowRunId: number,
  incomingGuidance?: string | null
): Promise<ReviewResult> {
  return runStructuredAgent(
    REVIEWER_SYSTEM_PROMPT,
    buildReviewerPrompt(
      JSON.stringify(productData),
      JSON.stringify(advertisement),
      incomingGuidance
    ),
    ReviewResultSchema,
    { workflowRunId, stepType: "REVIEWER" }
  );
}
