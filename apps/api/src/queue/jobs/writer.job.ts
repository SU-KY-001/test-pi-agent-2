import { AdvertisementSchema } from "@repo/contracts";
import { runWriterAgent, runWriterRegenerateAgent } from "../../agents/writer.agent";
import { AgentValidationError } from "../../agents/agent-runner";
import { log } from "../../config/logger";
import {
  createWorkflowStep,
  getStepVersion,
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../../workflow/workflow.repository";
import {
  loadApprovedPlannerOutput,
  loadLatestStepOutput,
} from "../../workflow/workflow.service";
import type { AgentJobPayload } from "../../workflow/workflow.types";

export async function handleWriterJob(payload: AgentJobPayload): Promise<void> {
  const run = await getWorkflowRun(payload.workflowRunId);
  if (!run) throw new Error(`Workflow ${payload.workflowRunId} not found`);

  let step = await getWorkflowStep(run.id, "WRITER");
  if (!step) step = await createWorkflowStep(run.id, "WRITER", "RUNNING");
  else await updateWorkflowStep(step.id, { status: "RUNNING", errorMessage: null });

  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "WRITER" });
  const isRegenerate = payload.feedback != null && payload.baseVersion != null;

  await logEvent({
    workflowRunId: run.id,
    type: isRegenerate ? "writer.regenerate.started" : "writer.started",
    message: isRegenerate
      ? `Writer regenerate started for workflow ${run.id}`
      : `Writer started for workflow ${run.id}`,
  });

  const jobLog = log.child({ scope: "agent-job", workflowRunId: run.id, step: "WRITER" });
  jobLog.info({ isRegenerate, feedback: payload.feedback, baseVersion: payload.baseVersion }, "Writer job started");

  try {
    const productData = await loadLatestStepOutput(run.id, "EXTRACTOR");
    const approved = await loadApprovedPlannerOutput(run.id);

    let nextVersion: number;

    if (isRegenerate) {
      const base = await getStepVersion(step.id, payload.baseVersion as number);
      if (!base) throw new Error(`Writer v${payload.baseVersion} not found`);
      const previousAd = AdvertisementSchema.parse(base.outputJson);
      nextVersion = (step.currentVersion ?? 0) + 1;

      const output = await runWriterRegenerateAgent(
        productData,
        approved.plan,
        approved.version,
        previousAd,
        payload.feedback as string,
        run.id,
        step.incomingGuidance
      );

      await insertStepVersion({
        workflowStepId: step.id,
        version: nextVersion,
        inputJson: {
          productData,
          approvedPlan: approved.plan,
          approvedVersion: approved.version,
          previousAd,
          feedback: payload.feedback,
          incomingGuidance: step.incomingGuidance ?? null,
        },
        outputJson: output,
        humanFeedback: payload.feedback,
        validationStatus: "valid",
      });

      await logEvent({
        workflowRunId: run.id,
        type: "writer.regenerated",
        message: `Writer regenerated v${nextVersion} for workflow ${run.id}`,
      });
    } else {
      nextVersion = 1;
      const output = await runWriterAgent(
        productData,
        approved.plan,
        approved.version,
        run.id,
        step.incomingGuidance
      );

      await insertStepVersion({
        workflowStepId: step.id,
        version: nextVersion,
        inputJson: {
          productData,
          approvedPlan: approved.plan,
          approvedVersion: approved.version,
          incomingGuidance: step.incomingGuidance ?? null,
        },
        outputJson: output,
        validationStatus: "valid",
      });

      await logEvent({
        workflowRunId: run.id,
        type: "writer.completed",
        message: `Writer v1 completed for workflow ${run.id} (planner v${approved.version})`,
      });
    }

    // HITL Review Gate: Step and Workflow wait for human review!
    await updateWorkflowStep(step.id, {
      status: "WAITING_FOR_HUMAN",
      currentVersion: nextVersion,
    });
    await updateWorkflowRun(run.id, {
      status: "WAITING_FOR_HUMAN",
      currentStep: "WRITER",
    });

    jobLog.info(
      { version: nextVersion, isRegenerate },
      "Writer job succeeded, waiting for human approval"
    );
  } catch (err) {
    jobLog.error({ err, isRegenerate }, "Writer job failed");
    const message = err instanceof Error ? err.message : String(err);
    if (
      err instanceof AgentValidationError ||
      /no approved version|not found|no completed version/i.test(message)
    ) {
      await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: message });
      await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "WRITER" });
      await logEvent({ workflowRunId: run.id, type: "writer.failed", message });
      return;
    }
    await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: message });
    await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "WRITER" });
    await logEvent({ workflowRunId: run.id, type: "writer.failed", message });
    throw err;
  }
}
