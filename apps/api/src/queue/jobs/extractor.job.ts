import { runExtractorAgent } from "../../agents/extractor.agent";
import { AgentValidationError } from "../../agents/agent-runner";
import {
  createWorkflowStep,
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../../workflow/workflow.repository";
import { MAX_QUEUE_RETRY_COUNT, WORKFLOW_QUEUES, type AgentJobPayload } from "../../workflow/workflow.types";
import { boss } from "../boss";

export async function handleExtractorJob(payload: AgentJobPayload): Promise<void> {
  const run = await getWorkflowRun(payload.workflowRunId);
  if (!run) throw new Error(`Workflow ${payload.workflowRunId} not found`);

  let step = await getWorkflowStep(run.id, "EXTRACTOR");
  if (!step) step = await createWorkflowStep(run.id, "EXTRACTOR", "RUNNING");
  else await updateWorkflowStep(step.id, { status: "RUNNING", errorMessage: null });

  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "EXTRACTOR" });
  await logEvent({ workflowRunId: run.id, type: "extractor.started", message: `Extractor started for workflow ${run.id}` });

  try {
    const output = await runExtractorAgent(run.rawProductText, run.id);
    await insertStepVersion({
      workflowStepId: step.id,
      version: 1,
      inputJson: { rawProductText: run.rawProductText },
      outputJson: output,
      validationStatus: "valid",
    });
    await updateWorkflowStep(step.id, { status: "COMPLETED", currentVersion: 1 });
    await logEvent({ workflowRunId: run.id, type: "extractor.completed", message: `Extractor v1 completed for workflow ${run.id}` });
  } catch (err) {
    // Business/schema errors fail fast; infra errors throw so pg-boss retries.
    if (err instanceof AgentValidationError) {
      await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: err.message });
      await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "EXTRACTOR" });
      await logEvent({ workflowRunId: run.id, type: "extractor.failed", message: err.message });
      return;
    }
    await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: String(err) });
    await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "EXTRACTOR" });
    await logEvent({ workflowRunId: run.id, type: "extractor.failed", message: String(err) });
    throw err;
  }

  // Why: step is COMPLETED here; enqueue failure must not flip it to FAILED
  // (retry would re-insert a duplicate v1). Throw so pg-boss retries the
  // enqueue only, leaving the completed version intact.
  const planner = await getWorkflowStep(run.id, "PLANNER");
  if (!planner) await createWorkflowStep(run.id, "PLANNER", "QUEUED");
  else await updateWorkflowStep(planner.id, { status: "QUEUED", errorMessage: null });
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "PLANNER" });
  try {
    await boss.send(
      WORKFLOW_QUEUES.PLANNER,
      { workflowRunId: run.id } satisfies AgentJobPayload,
      { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
    );
  } catch (err) {
    await logEvent({ workflowRunId: run.id, type: "extractor.enqueue.failed", message: String(err) });
    throw err;
  }
}
