import {
  AdvertisementSchema,
  type Advertisement,
  type ContentPlan,
  type ProductData,
} from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import { WRITER_SYSTEM_PROMPT, buildWriterPrompt, buildWriterRegeneratePrompt } from "./prompts";

export async function runWriterAgent(
  productData: ProductData,
  approvedPlan: ContentPlan,
  approvedVersion: number,
  workflowRunId: number,
  incomingGuidance?: string | null
): Promise<Advertisement> {
  return runStructuredAgent(
    WRITER_SYSTEM_PROMPT,
    buildWriterPrompt(
      JSON.stringify(productData),
      JSON.stringify(approvedPlan),
      approvedVersion,
      incomingGuidance
    ),
    AdvertisementSchema,
    { workflowRunId, stepType: "WRITER" }
  );
}

export async function runWriterRegenerateAgent(
  productData: ProductData,
  approvedPlan: ContentPlan,
  approvedVersion: number,
  previousAd: Advertisement,
  feedback: string,
  workflowRunId: number,
  incomingGuidance?: string | null
): Promise<Advertisement> {
  return runStructuredAgent(
    WRITER_SYSTEM_PROMPT,
    buildWriterRegeneratePrompt(
      JSON.stringify(productData),
      JSON.stringify(approvedPlan),
      approvedVersion,
      JSON.stringify(previousAd),
      feedback,
      incomingGuidance
    ),
    AdvertisementSchema,
    { workflowRunId, stepType: "WRITER" }
  );
}
