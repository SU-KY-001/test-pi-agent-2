import {
  ContentPlanSchema,
  type ContentPlan,
  type ProductData,
} from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import {
  PLANNER_SYSTEM_PROMPT,
  buildPlannerPrompt,
  buildPlannerRegeneratePrompt,
} from "./prompts";

export async function runPlannerAgent(productData: ProductData): Promise<ContentPlan> {
  return runStructuredAgent(
    PLANNER_SYSTEM_PROMPT,
    buildPlannerPrompt(JSON.stringify(productData)),
    ContentPlanSchema
  );
}

export async function runPlannerRegenerateAgent(
  productData: ProductData,
  previousPlan: ContentPlan,
  feedback: string
): Promise<ContentPlan> {
  return runStructuredAgent(
    PLANNER_SYSTEM_PROMPT,
    buildPlannerRegeneratePrompt(
      JSON.stringify(productData),
      JSON.stringify(previousPlan),
      feedback
    ),
    ContentPlanSchema
  );
}
