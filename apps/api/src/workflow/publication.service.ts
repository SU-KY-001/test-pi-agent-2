import { OralizedScriptSchema, type OralizedScript } from "@repo/contracts";
import { findAncestorNode } from "./workflow.service";
import { getAncestryLineage, getNodeWithType } from "./workflow-lineage.service";
import { insertPublication, listPublications } from "./workflow.repository";

/** Kịch bản xuất bản = 3 tập văn nói ghép lại, giữ tiêu đề tập làm mốc. */
export function buildFinalScript(script: OralizedScript): string {
  return script.episodes
    .map((episode) => `# ${episode.episodeTitle}\n\n${episode.spokenNarration}`)
    .join("\n\n---\n\n");
}

export function totalEstimatedSeconds(script: OralizedScript): number {
  return script.episodes.reduce((sum, episode) => sum + episode.estimatedDurationSeconds, 0);
}

/**
 * Gate 2: ghi bản ghi xuất bản bất biến trỏ vào node đã được Moderator duyệt.
 * Idempotent theo `approvedVersionId` để double-click không tạo bản ghi trùng.
 */
export async function publishFromApprovedNode(params: {
  workflowRunId: number;
  approvedVersionId: number;
  approvedBy: string;
}) {
  const existing = (await listPublications(params.workflowRunId)).find(
    (row) => row.approvedVersionId === params.approvedVersionId
  );
  if (existing) return existing;

  const approvedNode = await getNodeWithType(params.approvedVersionId);
  if (!approvedNode) {
    throw new Error(`Node ${params.approvedVersionId} không tồn tại`);
  }

  const { ancestors } = await getAncestryLineage(params.approvedVersionId);
  const oralizerNode = findAncestorNode(ancestors, "ORALIZER");
  if (!oralizerNode) {
    throw new Error("Không tìm thấy bản kịch bản văn nói (ORALIZER) trên nhánh được duyệt");
  }

  const script = OralizedScriptSchema.parse(oralizerNode.outputJson);
  return insertPublication({
    workflowRunId: params.workflowRunId,
    approvedVersionId: params.approvedVersionId,
    approvedBy: params.approvedBy,
    finalScript: buildFinalScript(script),
    wordCount: script.totalWordCount,
    estimatedDurationSeconds: totalEstimatedSeconds(script),
  });
}
