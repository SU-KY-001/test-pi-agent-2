import type { z } from "zod";
import { STEP_OUTPUT_SCHEMAS, type StepPayloadMap, type StepType } from "@repo/contracts";
import { runStructuredAgent } from "./agent-runner";
import { STEP_TOOL_POLICY, buildStepPrompt, type StepPromptContext } from "./step-prompt.mapper";

/**
 * Một cửa duy nhất cho cả 7 tác tử Flow 2.
 *
 * Deviation so với plan (7 file agent riêng): 7 tác tử chỉ khác nhau ở
 * system prompt + schema + chính sách tool, nên gom về một hàm generic.
 * Thêm tác tử mới = thêm một case trong step-prompt.mapper + một entry
 * trong STEP_OUTPUT_SCHEMAS, không cần file thứ ba.
 */
export interface WorkflowAgentOptions {
  workflowRunId: number;
}

export async function runWorkflowStepAgent<S extends StepType>(
  stepType: S,
  ctx: StepPromptContext,
  options: WorkflowAgentOptions
): Promise<StepPayloadMap[S]> {
  const { systemPrompt, userPrompt } = buildStepPrompt(stepType, ctx);

  // STEP_OUTPUT_SCHEMAS[stepType] là union của các schema; cast về schema cụ
  // thể là hệ quả của việc tra cứu bằng biến. Giá trị trả về vẫn được Zod
  // validate và bị ràng buộc bởi StepPayloadMap[S].
  // SAFETY: STEP_OUTPUT_SCHEMAS ánh xạ mỗi StepType đúng một schema tương ứng,
  // nên tra cứu là đúng; TypeScript không narrow được union theo biến S.
  const schema = STEP_OUTPUT_SCHEMAS[stepType] as unknown as z.ZodType<StepPayloadMap[S]>;

  return runStructuredAgent(systemPrompt, userPrompt, schema, {
    workflowRunId: options.workflowRunId,
    stepType,
    toolPolicy: STEP_TOOL_POLICY[stepType],
  });
}
