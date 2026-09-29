import {
  AdvertisementSchema,
  type Advertisement,
  type ContentPlan,
  type ProductData,
} from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import { WRITER_SYSTEM_PROMPT, buildWriterPrompt } from "./prompts";

export async function runWriterAgent(
  productData: ProductData,
  approvedPlan: ContentPlan,
  approvedVersion: number,
  workflowRunId: number
): Promise<Advertisement> {
  return runStructuredAgent(
    WRITER_SYSTEM_PROMPT,
    buildWriterPrompt(
      JSON.stringify(productData),
      JSON.stringify(approvedPlan),
      approvedVersion
    ),
    AdvertisementSchema,
    { workflowRunId, stepType: "WRITER" }
  );
}
