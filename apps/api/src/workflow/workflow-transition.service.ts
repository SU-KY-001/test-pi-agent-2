import { STEP_REVIEW_POLICY } from "@repo/contracts";
import { log } from "../config/logger";
import { boss } from "../queue/boss";
import {
  getNextStepType,
  getDownstreamStepTypes,
} from "./workflow-order";
import {
  atomicTransitionStepStatus,
  createWorkflowStep,
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  setDownstreamStepsStale,
  updateWorkflowRun,
  updateWorkflowStep,
} from "./workflow.repository";
import { STEP_OUTPUT_SCHEMAS } from "./workflow.service";
import {
  MAX_QUEUE_RETRY_COUNT,
  WORKFLOW_QUEUES,
  type AgentJobPayload,
  type StepType,
} from "./workflow.types";

export type TransitionResult<T = unknown> =
  | { success: true; data?: T }
  | { success: false; error: string; status: 400 | 404 | 409 | 500; details?: unknown };

export async function continueStepWithGuidance(
  workflowRunId: number,
  stepType: StepType,
  version: number,
  incomingGuidance?: string
): Promise<TransitionResult<{ nextStep: StepType | null }>> {
  const run = await getWorkflowRun(workflowRunId);
  if (!run) return { success: false, error: "Workflow not found", status: 404 };

  const step = await getWorkflowStep(workflowRunId, stepType);
  if (!step) return { success: false, error: `Step ${stepType} not found`, status: 404 };

  // Optimistic lock: only transition if step is WAITING_FOR_HUMAN and at requested version
  const transitioned = await atomicTransitionStepStatus(
    step.id,
    "WAITING_FOR_HUMAN",
    version,
    {
      status: "COMPLETED",
      approvedVersion: version,
    }
  );

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
    metadataJson: { stepType, version, guidance: incomingGuidance ?? null },
  });

  const nextStepType = getNextStepType(stepType);

  if (nextStepType) {
    // Check if next step exists or create it
    let nextStep = await getWorkflowStep(workflowRunId, nextStepType);
    if (!nextStep) {
      nextStep = await createWorkflowStep(workflowRunId, nextStepType, "QUEUED");
    } else {
      await updateWorkflowStep(nextStep.id, {
        status: "QUEUED",
        incomingGuidance: incomingGuidance ?? null,
      });
    }

    if (incomingGuidance) {
      await updateWorkflowStep(nextStep.id, { incomingGuidance });
    }

    await updateWorkflowRun(workflowRunId, {
      status: "RUNNING",
      currentStep: nextStepType,
    });

    await logEvent({
      workflowRunId,
      type: `step.${nextStepType.toLowerCase()}.queued`,
      message: `Step ${nextStepType} queued`,
      metadataJson: { incomingGuidance: incomingGuidance ?? null },
    });

    await boss.send(
      WORKFLOW_QUEUES[nextStepType],
      { workflowRunId } satisfies AgentJobPayload,
      { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
    );

    log.info(
      { scope: "workflow-transition", workflowRunId, stepType, nextStepType },
      "Step approved and next step queued"
    );

    return { success: true, data: { nextStep: nextStepType } };
  } else {
    // Pipeline complete
    await updateWorkflowRun(workflowRunId, {
      status: "COMPLETED",
      currentStep: null,
      completedAt: new Date(),
    });

    await logEvent({
      workflowRunId,
      type: "workflow.completed",
      message: `Workflow ${workflowRunId} completed successfully`,
    });

    log.info(
      { scope: "workflow-transition", workflowRunId, stepType },
      "Final step approved, workflow completed"
    );

    return { success: true, data: { nextStep: null } };
  }
}

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

  // If step was completed or has downstream steps, invalidate them
  const downstream = getDownstreamStepTypes(stepType);
  if (downstream.length > 0) {
    await setDownstreamStepsStale(workflowRunId, downstream);
    await logEvent({
      workflowRunId,
      type: "workflow.downstream_invalidated",
      message: `Downstream steps invalidated by rerun of ${stepType}`,
      metadataJson: { stepType, downstream },
    });
  }

  // Update step to QUEUED
  await updateWorkflowStep(step.id, { status: "QUEUED" });
  await updateWorkflowRun(workflowRunId, {
    status: "RUNNING",
    currentStep: stepType,
  });

  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.regenerating`,
    message: `Regenerating ${stepType} from v${step.currentVersion}`,
    metadataJson: { feedback, baseVersion: step.currentVersion },
  });

  await boss.send(
    WORKFLOW_QUEUES[stepType],
    {
      workflowRunId,
      feedback: feedback.trim(),
      baseVersion: step.currentVersion,
    } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );

  log.info(
    { scope: "workflow-transition", workflowRunId, stepType, baseVersion: step.currentVersion },
    "Step rerun enqueued with feedback"
  );

  return { success: true };
}

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

  // Validate schema
  const schema = STEP_OUTPUT_SCHEMAS[stepType];
  const parseResult = schema.safeParse(editedOutputJson);
  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid edited output schema",
      details: parseResult.error.format(),
      status: 400,
    };
  }

  const nextVersion = baseVersion + 1;
  await insertStepVersion({
    workflowStepId: step.id,
    version: nextVersion,
    inputJson: { directEdit: true, baseVersion, note: note ?? null },
    outputJson: parseResult.data,
    humanFeedback: note ? `[Direct Edit] ${note}` : "[Direct Edit]",
    validationStatus: "valid",
  });

  await updateWorkflowStep(step.id, {
    currentVersion: nextVersion,
  });

  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.direct_edited`,
    message: `Step ${stepType} directly edited to v${nextVersion}`,
    metadataJson: { baseVersion, newVersion: nextVersion, note: note ?? null },
  });

  log.info(
    { scope: "workflow-transition", workflowRunId, stepType, nextVersion },
    "Direct edit saved as new version"
  );

  return { success: true, data: { newVersion: nextVersion, output: parseResult.data } };
}
