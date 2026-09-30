import { ContentPlanSchema } from "@repo/contracts";
import {
  runPlannerAgent,
  runPlannerRegenerateAgent,
} from "../../agents/planner.agent";
import { AgentValidationError } from "../../agents/agent-runner";
import {
  getStepVersion,
  getWorkflowRun,
  getWorkflowStep,
  insertStepVersion,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../../workflow/workflow.repository";
import { loadLatestStepOutput } from "../../workflow/workflow.service";
import { log } from "../../config/logger";
import type { AgentJobPayload } from "../../workflow/workflow.types";

export async function handlePlannerJob(payload: AgentJobPayload): Promise<void> {
  const run = await getWorkflowRun(payload.workflowRunId);
  if (!run) throw new Error(`Workflow ${payload.workflowRunId} not found`);

  const step = await getWorkflowStep(run.id, "PLANNER");
  if (!step) throw new Error(`Planner step missing for workflow ${run.id}`);

  await updateWorkflowStep(step.id, { status: "RUNNING", errorMessage: null });
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "PLANNER" });
  await logEvent({
    workflowRunId: run.id,
    type: payload.feedback ? "planner.regenerate.started" : "planner.started",
    message: `Planner started for workflow ${run.id}`,
  });
  const isRegenerate = payload.feedback != null && payload.baseVersion != null;
  const jobLog = log.child({ scope: "agent-job", workflowRunId: run.id, step: "PLANNER" });
  jobLog.info({ isRegenerate, feedback: payload.feedback, baseVersion: payload.baseVersion }, isRegenerate ? "Planner regenerate job started" : "Planner job started");

  try {
    const productData = await loadLatestStepOutput(run.id, "EXTRACTOR");

    if (isRegenerate) {
      const base = await getStepVersion(step.id, payload.baseVersion as number);
      if (!base) throw new Error(`Planner v${payload.baseVersion} not found`);
      const previousPlan = ContentPlanSchema.parse(base.outputJson);
      const output = await runPlannerRegenerateAgent(
        productData,
        previousPlan,
        payload.feedback as string,
        run.id
      );
      await insertStepVersion({
        workflowStepId: step.id,
        version: (step.currentVersion ?? 0) + 1,
        inputJson: { productData, previousPlan, feedback: payload.feedback },
        outputJson: output,
        humanFeedback: payload.feedback,
        validationStatus: "valid",
      });
      await logEvent({ workflowRunId: run.id, type: "planner.regenerated", message: `Planner regenerated for workflow ${run.id}` });
    } else {
      const output = await runPlannerAgent(productData, run.id);
      await insertStepVersion({
        workflowStepId: step.id,
        version: 1,
        inputJson: { productData },
        outputJson: output,
        validationStatus: "valid",
      });
      await logEvent({ workflowRunId: run.id, type: "planner.completed", message: `Planner v1 completed for workflow ${run.id}` });
    }

    const nextVersion = (step.currentVersion ?? 0) + 1;
    await updateWorkflowStep(step.id, { status: "WAITING_FOR_HUMAN", currentVersion: nextVersion });
    await updateWorkflowRun(run.id, { status: "WAITING_FOR_HUMAN", currentStep: "PLANNER" });
    jobLog.info({ version: nextVersion, isRegenerate }, "Planner job succeeded, waiting for human approval");
  } catch (err) {
    jobLog.error({ err, isRegenerate }, "Planner job failed");
    if (err instanceof AgentValidationError) {
      await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: err.message });
      await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "PLANNER" });
      await logEvent({ workflowRunId: run.id, type: "planner.failed", message: err.message });
      return;
    }
    if (err instanceof Error && /missing|not found|no completed version/i.test(err.message)) {
      await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: err.message });
      await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "PLANNER" });
      await logEvent({ workflowRunId: run.id, type: "planner.failed", message: err.message });
      return;
    }
    await updateWorkflowStep(step.id, { status: "FAILED", errorMessage: String(err) });
    await updateWorkflowRun(run.id, { status: "FAILED", currentStep: "PLANNER" });
    await logEvent({ workflowRunId: run.id, type: "planner.failed", message: String(err) });
    throw err;
  }
}
