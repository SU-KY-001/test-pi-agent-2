import { ProductDataSchema, type ProductData } from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import { EXTRACTOR_SYSTEM_PROMPT, buildExtractorPrompt } from "./prompts";

export async function runExtractorAgent(rawProductText: string, workflowRunId: number): Promise<ProductData> {
  return runStructuredAgent(
    EXTRACTOR_SYSTEM_PROMPT,
    buildExtractorPrompt(rawProductText),
    ProductDataSchema,
    { workflowRunId, stepType: "EXTRACTOR" }
  );
}
