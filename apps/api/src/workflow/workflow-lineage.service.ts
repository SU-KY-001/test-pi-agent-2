import type { StepVersion } from "@repo/db";
import { getStepVersionById } from "./workflow.repository";
import type { StepType } from "./workflow.types";

export interface LineageNode {
  id: number;
  stepType: StepType;
  version: number;
  parentVersionId: number | null;
  outputJson: unknown;
  humanFeedback: string | null;
  createdAt: Date;
}

export interface AncestryLineage {
  /** Tổ tiên theo thứ tự thời gian (root → node cha). */
  ancestors: LineageNode[];
  /** stepType → output mới nhất trên nhánh tổ tiên. */
  predecessorOutputs: Partial<Record<StepType, unknown>>;
}

/**
 * Truy ngược `parent_version_id` lên root để dựng ngữ cảnh cho node đang chạy.
 * Mỗi node chỉ "nhìn thấy" tổ tiên của chính nhánh mình, nên fork không làm
 * bẩn các nhánh khác.
 */
export async function getAncestryLineage(parentVersionId: number | null): Promise<AncestryLineage> {
  const ancestors: LineageNode[] = [];
  let currentId = parentVersionId;

  while (currentId != null) {
    const row = await getStepVersionById(currentId);
    if (!row) break;
    ancestors.unshift(toLineageNode(row));
    currentId = row.node.parentVersionId;
  }

  const predecessorOutputs: Partial<Record<StepType, unknown>> = {};
  for (const node of ancestors) {
    if (node.outputJson != null) predecessorOutputs[node.stepType] = node.outputJson;
  }

  return { ancestors, predecessorOutputs };
}

function toLineageNode(row: { node: StepVersion; stepType: string }): LineageNode {
  return {
    id: row.node.id,
    stepType: row.stepType as StepType,
    version: row.node.version,
    parentVersionId: row.node.parentVersionId,
    outputJson: row.node.outputJson,
    humanFeedback: row.node.humanFeedback,
    createdAt: row.node.createdAt,
  };
}

/** Bản ghi đầy đủ của một node (dùng để dựng payload/response). */
export async function getNodeWithType(id: number) {
  const row = await getStepVersionById(id);
  return row ? toLineageNode(row) : null;
}
