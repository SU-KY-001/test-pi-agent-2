import { runReviewerAgent } from "../../agents/reviewer.agent";
import { AgentValidationError } from "../../agents/agent-runner";
import {
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../../workflow/workflow.repository";
import { loadLatestStepOutput } from "../../workflow/workflow.service";
import type { AgentJobPayload } from "../../workflow/workflow.types";

export async function handleReviewerJob(payload: AgentJobPayload): Promise<void> {
  const run = await getWorkflowRun(payload.workflowRunId);
  if (!run) throw new Error(`Workflow ${payload.workflowRunId} not found`);

  const step = await getWorkflowStep(run.id, "REVIEWER");
  if (!step) throw new Error(`Reviewer step missing for workflow ${run.id}`);

  await updateWorkflowStep(step.id, { status: "RUNNING", errorMessage: null });
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "REVIEWER" });
  await logEvent({ workflowRunId: run.id, type: "reviewer.started", message: `Reviewer started for workflow ${run.id}` });

  try {
    const productData = await loadLatestStepOutput(run.id, "EXTRACTOR");
    const advertisement = await loadLatestStepOutput(run.id, "WRITER");
    const output = await runReviewerAgent(productData, advertisement, run.id);
    await insertStepVersion({
      workflowStepId: step.id,
      version: 1,
      inputJson: { productData, advertisement },
      outputJson: output,
      validationStatus: "valid",
    });
    await updateWorkflowStep(step.id, { status: "COMPLETED", currentVersion: 1 });
    // Reviewer passed=false still counts as COMPLETED: it finished its audit job.
    await updateWorkflowRun(run.id, { status: "COMPLETED", currentStep: "REVIEWER", completedAt: new Date() });
    await logEvent({
      workflowRunId: run.id,
      type: "reviewer.completed",
      message: `Reviewer v1 completed for workflow ${run.id} (passed=${output.passed})`,
      metadataJson: { passed: output.passed },
    });
    await logEvent({ workflowRunId: run.id, type: "workflow.completed", message: `Workflow ${run.id} completed` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof AgentValidationError || /not found|no completed version|missing/i.test(message)) {
      await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: message });
      await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "REVIEWER" });
      await logEvent({ workflowRunId: run.id, type: "reviewer.failed", message });
      return;
    }
    await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: message });
    await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "REVIEWER" });
    await logEvent({ workflowRunId: run.id, type: "reviewer.failed", message });
    throw err;
  }
}
