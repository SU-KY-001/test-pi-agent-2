import { STEP_OUTPUT_SCHEMAS } from "@repo/contracts";
import { log } from "../config/logger";
import { boss } from "../queue/boss";
import { publishFromApprovedNode } from "./publication.service";
import { getDownstreamStepTypes, getNextStepType } from "./workflow-order";
import {
  atomicTransitionStepStatus,
  ensureWorkflowStep,
  getStepVersion,
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  setDownstreamStepsStale,
  updateWorkflowRun,
  updateWorkflowStep,
} from "./workflow.repository";
import { loadNodeByStepVersion } from "./workflow.service";
import {
  MAX_QUEUE_RETRY_COUNT,
  WORKFLOW_QUEUES,
  type AgentJobPayload,
  type NarrativeSelectionPayload,
  type StepType,
} from "./workflow.types";

export type TransitionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; status: 400 | 404 | 409 | 500; details?: unknown };

/**
 * Moderator duyệt một node ở trạm HITL: đánh dấu step COMPLETED, rồi hoặc
 * enqueue bước kế tiếp với `parentVersionId` = node vừa duyệt (giữ nhánh),
 * hoặc ở FACT_CHECKER thì ghi bản ghi xuất bản và kết thúc run.
 */
export async function continueStepWithGuidance(
  workflowRunId: number,
  stepType: StepType,
  version: number,
  incomingGuidance?: string,
  narrativeSelection?: NarrativeSelectionPayload
): Promise<TransitionResult<{ nextStep: StepType | null; publicationId?: number }>> {
  const run = await getWorkflowRun(workflowRunId);
  if (!run) return { success: false, error: "Workflow not found", status: 404 };

  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step) return { success: false, error: `Step ${stepType} not found`, status: 404 };

  const approvedNode = await loadNodeByStepVersion(workflowRunId, stepType, version);
  if (!approvedNode) {
    return { success: false, error: `Node ${stepType} v${version} not found`, status: 404 };
  }

  // Optimistic lock: chỉ chuyển được khi step đang chờ người và đúng version.
  const transitioned = await atomicTransitionStepStatus(step.id, "WAITING_FOR_HUMAN", version, {
    status: "COMPLETED",
    approvedVersion: version,
  });
  if (!transitioned) {
    return {
      success: false,
      error: `Conflict: Step ${stepType} is not WAITING_FOR_HUMAN at version ${version}`,
      status: 409,
    };
  }

  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.approved`,
    message: `Step ${stepType} approved v${version}`,
    metadataJson: {
      stepType,
      version,
      nodeId: approvedNode.id,
      guidance: incomingGuidance ?? null,
      narrativeSelection: narrativeSelection ?? null,
    },
  });

  const nextStepType = getNextStepType(stepType);

  if (!nextStepType) {
    // Gate 2: node FACT_CHECKER vừa được duyệt ⇒ ghi bản ghi xuất bản.
    const publication = await publishFromApprovedNode({
      workflowRunId,
      approvedVersionId: approvedNode.id,
      approvedBy: "Moderator",
    });

    await updateWorkflowRun(workflowRunId, {
      status: "COMPLETED",
      currentStep: null,
      completedAt: new Date(),
    });

    await logEvent({
      workflowRunId,
      type: "workflow.completed",
      message: `Workflow ${workflowRunId} published as podcast #${publication.id}`,
      metadataJson: { publicationId: publication.id, wordCount: publication.wordCount },
    });

    log.info({ scope: "workflow-transition", workflowRunId, publicationId: publication.id }, "Published");

    return { success: true, data: { nextStep: null, publicationId: publication.id } };
  }

  const nextStep = await ensureWorkflowStep(workflowRunId, nextStepType, "QUEUED");
  await updateWorkflowStep(nextStep.id, {
    status: "QUEUED",
    incomingGuidance: incomingGuidance ?? null,
  });
  await updateWorkflowRun(workflowRunId, { status: "RUNNING", currentStep: nextStepType });

  await boss.send(
    WORKFLOW_QUEUES[nextStepType],
    {
      workflowRunId,
      stepType: nextStepType,
      parentVersionId: approvedNode.id,
      guidance: incomingGuidance,
      narrativeSelection,
    } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );

  await logEvent({
    workflowRunId,
    type: `step.${nextStepType.toLowerCase()}.queued`,
    message: `Step ${nextStepType} queued from ${stepType} v${version}`,
    metadataJson: { parentVersionId: approvedNode.id, incomingGuidance: incomingGuidance ?? null },
  });

  log.info(
    { scope: "workflow-transition", workflowRunId, stepType, nextStepType },
    "Step approved and next step queued"
  );

  return { success: true, data: { nextStep: nextStepType } };
}

/**
 * Fork: chạy lại chính bước đó thành node mới là anh em với node hiện tại
 * (parent = parent của node hiện tại), nên nhánh cũ vẫn xem lại được nguyên vẹn.
 */
export async function rerunStepWithFeedback(
  workflowRunId: number,
  stepType: StepType,
  feedback: string
): Promise<TransitionResult> {
  const run = await getWorkflowRun(workflowRunId);
  if (!run) return { success: false, error: "Workflow not found", status: 404 };

  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step || step.currentVersion == null) {
    return { success: false, error: `Step ${stepType} has no existing version to rerun`, status: 400 };
  }

  const currentNode = await getStepVersion(step.id, step.currentVersion);
  if (!currentNode) {
    return { success: false, error: `Step ${stepType} v${step.currentVersion} not found`, status: 404 };
  }

  const downstream = getDownstreamStepTypes(stepType);
  if (downstream.length > 0) {
    await setDownstreamStepsStale(workflowRunId, downstream);
    await logEvent({
      workflowRunId,
      type: "workflow.downstream_invalidated",
      message: `Downstream steps invalidated by fork of ${stepType} v${step.currentVersion}`,
      metadataJson: { stepType, downstream, forkFromNodeId: currentNode.id },
    });
  }

  await updateWorkflowStep(step.id, { status: "QUEUED" });
  await updateWorkflowRun(workflowRunId, { status: "RUNNING", currentStep: stepType });

  await boss.send(
    WORKFLOW_QUEUES[stepType],
    {
      workflowRunId,
      stepType,
      parentVersionId: currentNode.parentVersionId,
      guidance: feedback.trim(),
    } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );

  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.forked`,
    message: `Fork ${stepType} from parent ${currentNode.parentVersionId ?? "root"}`,
    metadataJson: {
      stepType,
      forkedFromNodeId: currentNode.id,
      parentVersionId: currentNode.parentVersionId,
      feedback,
    },
  });

  log.info(
    { scope: "workflow-transition", workflowRunId, stepType, forkedFromNodeId: currentNode.id },
    "Fork enqueued with feedback"
  );

  return { success: true };
}

/** Sửa tay output của Moderator: node mới kế thừa trực tiếp node gốc. */
export async function directEditStep(
  workflowRunId: number,
  stepType: StepType,
  baseVersion: number,
  editedOutputJson: unknown,
  note?: string
): Promise<TransitionResult<{ newVersion: number; output: unknown }>> {
  const run = await getWorkflowRun(workflowRunId);
  if (!run) return { success: false, error: "Workflow not found", status: 404 };

  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step) return { success: false, error: `Step ${stepType} not found`, status: 404 };

  if (step.status !== "WAITING_FOR_HUMAN") {
    return {
      success: false,
      error: `Step must be WAITING_FOR_HUMAN to edit (current: ${step.status})`,
      status: 409,
    };
  }

  if (step.currentVersion !== baseVersion) {
    return {
      success: false,
      error: `Conflict: Step version mismatch (expected ${baseVersion}, current: ${step.currentVersion})`,
      status: 409,
    };
  }

  const parseResult = STEP_OUTPUT_SCHEMAS[stepType].safeParse(editedOutputJson);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid edited output schema",
      details: parseResult.error.format(),
      status: 400,
    };
  }

  const baseNode = await getStepVersion(step.id, baseVersion);
  const nextVersion = baseVersion + 1;
  await insertStepVersion({
    workflowStepId: step.id,
    version: nextVersion,
    parentVersionId: baseNode?.id ?? null,
    inputJson: { directEdit: true, baseVersion, note: note ?? null },
    outputJson: parseResult.data,
    humanFeedback: note ? `[Direct Edit] ${note}` : "[Direct Edit]",
    validationStatus: "valid",
  });

  await updateWorkflowStep(step.id, { currentVersion: nextVersion });

  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.direct_edited`,
    message: `Step ${stepType} directly edited to v${nextVersion}`,
    metadataJson: { baseVersion, newVersion: nextVersion, note: note ?? null },
  });

  return { success: true, data: { newVersion: nextVersion, output: parseResult.data } };
}
