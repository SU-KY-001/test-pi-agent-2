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

export async function runPlannerAgent(productData: ProductData, workflowRunId: number): Promise<ContentPlan> {
  return runStructuredAgent(
    PLANNER_SYSTEM_PROMPT,
    buildPlannerPrompt(JSON.stringify(productData)),
    ContentPlanSchema,
    { workflowRunId, stepType: "PLANNER" }
  );
}

export async function runPlannerRegenerateAgent(
  productData: ProductData,
  previousPlan: ContentPlan,
  feedback: string,
  workflowRunId: number
): Promise<ContentPlan> {
  return runStructuredAgent(
    PLANNER_SYSTEM_PROMPT,
    buildPlannerRegeneratePrompt(
      JSON.stringify(productData),
      JSON.stringify(previousPlan),
      feedback
    ),
    ContentPlanSchema,
    { workflowRunId, stepType: "PLANNER" }
  );
}
