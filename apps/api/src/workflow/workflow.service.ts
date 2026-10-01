import {
  STEP_OUTPUT_SCHEMAS,
  type StepPayloadMap,
  type StepType,
} from "@repo/contracts";
import { getAncestryLineage, type LineageNode } from "./workflow-lineage.service";
import {
  ensureWorkflowStep,
  getStepVersion,
  insertStepVersion,
  updateWorkflowStep,
} from "./workflow.repository";

/**
 * Node chỉ nhìn thấy output của tổ tiên cùng nhánh. Nếu bước trước chưa có
 * trên nhánh này (fork thiếu dữ liệu) thì ném lỗi để job fail rõ ràng thay vì
 * chạy với ngữ cảnh rỗng.
 */
export async function loadPredecessorOutput<K extends StepType>(
  parentVersionId: number | null,
  stepType: K
): Promise<StepPayloadMap[K]> {
  const { predecessorOutputs } = await getAncestryLineage(parentVersionId);
  const output = predecessorOutputs[stepType];
  if (output == null) {
    throw new Error(`Lineage thiếu output của bước ${stepType} (parent=${parentVersionId ?? "root"})`);
  }
  return STEP_OUTPUT_SCHEMAS[stepType].parse(output) as StepPayloadMap[K];
}

/** Toàn bộ ngữ cảnh tổ tiên thô, dùng cho prompt/audit. */
export async function loadLineage(parentVersionId: number | null) {
  return getAncestryLineage(parentVersionId);
}

export function findAncestorNode(
  ancestors: LineageNode[],
  stepType: StepType
): LineageNode | null {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (node && node.stepType === stepType) return node;
  }
  return null;
}

/**
 * Ghi một node bất biến mới cho bước đang chạy và trỏ current_version của step
 * vào node đó. Version đếm theo từng workflow_step, còn nhánh được xác định
 * bằng parentVersionId.
 */
export async function saveStepNode<T extends StepType>(params: {
  workflowRunId: number;
  stepType: T;
  parentVersionId: number | null;
  input: unknown;
  output: StepPayloadMap[T];
  humanFeedback?: string | null;
}) {
  const step = await ensureWorkflowStep(params.workflowRunId, params.stepType);
  const nextVersion = (step.currentVersion ?? 0) + 1;
  const node = await insertStepVersion({
    workflowStepId: step.id,
    version: nextVersion,
    parentVersionId: params.parentVersionId,
    inputJson: params.input,
    outputJson: params.output,
    humanFeedback: params.humanFeedback ?? null,
  });
  await updateWorkflowStep(step.id, { currentVersion: nextVersion });
  return { step, node };
}

/** Bản ghi node của một (step, version) — đơn vị Moderator duyệt. */
export async function loadNodeByStepVersion(
  workflowRunId: number,
  stepType: StepType,
  version: number
) {
  const step = await ensureWorkflowStep(workflowRunId, stepType);
  return getStepVersion(step.id, version);
}
