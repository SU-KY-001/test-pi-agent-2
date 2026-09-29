import { runWriterAgent } from "../../agents/writer.agent";
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
import {
  loadApprovedPlannerOutput,
  loadLatestStepOutput,
} from "../../workflow/workflow.service";
import { MAX_QUEUE_RETRY_COUNT, WORKFLOW_QUEUES, type AgentJobPayload } from "../../workflow/workflow.types";
import { boss } from "../boss";

export async function handleWriterJob(payload: AgentJobPayload): Promise<void> {
  const run = await getWorkflowRun(payload.workflowRunId);
  if (!run) throw new Error(`Workflow ${payload.workflowRunId} not found`);

  let step = await getWorkflowStep(run.id, "WRITER");
  if (!step) step = await createWorkflowStep(run.id, "WRITER", "RUNNING");
  else await updateWorkflowStep(step.id, { status: "RUNNING", errorMessage: null });

  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "WRITER" });
  await logEvent({ workflowRunId: run.id, type: "writer.started", message: `Writer started for workflow ${run.id}` });

  try {
    const productData = await loadLatestStepOutput(run.id, "EXTRACTOR");
    // Writer proves it uses the approved version: load approved plan, embed version in input.
    const approved = await loadApprovedPlannerOutput(run.id);
    const output = await runWriterAgent(productData, approved.plan, approved.version);
    await insertStepVersion({
      workflowStepId: step.id,
      version: 1,
      inputJson: {
        productData,
        approvedPlan: approved.plan,
        approvedVersion: approved.version,
      },
      outputJson: output,
      validationStatus: "valid",
    });
    await updateWorkflowStep(step.id, { status: "COMPLETED", currentVersion: 1 });
    await logEvent({ workflowRunId: run.id, type: "writer.completed", message: `Writer v1 completed for workflow ${run.id} (planner v${approved.version})` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof AgentValidationError || /no approved version|not found|no completed version/i.test(message)) {
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

  // Why: step is COMPLETED here; enqueue failure must not flip it to FAILED.
  const reviewer = await getWorkflowStep(run.id, "REVIEWER");
  if (!reviewer) await createWorkflowStep(run.id, "REVIEWER", "QUEUED");
  else await updateWorkflowStep(reviewer.id, { status: "QUEUED", errorMessage: null });
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "REVIEWER" });
  try {
    await boss.send(
      WORKFLOW_QUEUES.REVIEWER,
      { workflowRunId: run.id } satisfies AgentJobPayload,
      { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
    );
  } catch (err) {
    await logEvent({ workflowRunId: run.id, type: "writer.enqueue.failed", message: String(err) });
    throw err;
  }
}
