import { Hono } from "hono";
import {
  ApprovePlannerRequestSchema,
  CreateWorkflowRequestSchema,
  CreateWorkflowResponseSchema,
  GetWorkflowResponseSchema,
  RegeneratePlannerRequestSchema,
} from "@repo/contracts";
import { boss } from "../queue/boss";
import {
  createWorkflowRun,
  createWorkflowStep,
  getStepVersion,
  getStepVersions,
  getWorkflowRun,
  getWorkflowStep,
  listWorkflowSteps,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../workflow/workflow.repository";
import {
  MAX_QUEUE_RETRY_COUNT,
  MAX_RAW_PRODUCT_TEXT_LENGTH,
  WORKFLOW_QUEUES,
  type AgentJobPayload,
} from "../workflow/workflow.types";

export const workflowRoute = new Hono();

workflowRoute.post("/", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = CreateWorkflowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.format() }, 400);
  }
  const rawProductText = parsed.data.rawProductText.trim();
  if (rawProductText.length > MAX_RAW_PRODUCT_TEXT_LENGTH) {
    return c.json({ error: `rawProductText exceeds ${MAX_RAW_PRODUCT_TEXT_LENGTH} chars` }, 400);
  }

  const run = await createWorkflowRun(rawProductText);
  await createWorkflowStep(run.id, "EXTRACTOR", "QUEUED");
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "EXTRACTOR" });
  await logEvent({ workflowRunId: run.id, type: "workflow.created", message: `Workflow ${run.id} created` });
  await boss.send(
    WORKFLOW_QUEUES.EXTRACTOR,
    { workflowRunId: run.id } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );

  const response = CreateWorkflowResponseSchema.safeParse({ id: run.id });
  if (!response.success) return c.json({ error: "Invalid response" }, 500);
  return c.json(response.data, 201);
});

workflowRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const run = await getWorkflowRun(id);
  if (!run) return c.json({ error: "Workflow not found" }, 404);

  const steps = await listWorkflowSteps(id);
  const stepsPayload = await Promise.all(
    steps.map(async (s) => {
      const versions = await getStepVersions(s.id);
      return {
        type: s.stepType,
        status: s.status,
        currentVersion: s.currentVersion,
        approvedVersion: s.approvedVersion,
        errorMessage: s.errorMessage,
        versions: versions.map((v) => ({
          version: v.version,
          inputJson: v.inputJson,
          outputJson: v.outputJson,
          humanFeedback: v.humanFeedback,
          validationStatus: v.validationStatus,
          createdAt: v.createdAt?.toISOString() ?? "",
        })),
      };
    })
  );

  const payload = {
    id: run.id,
    status: run.status,
    rawProductText: run.rawProductText,
    currentStep: run.currentStep,
    steps: stepsPayload,
  };
  const parsed = GetWorkflowResponseSchema.safeParse(payload);
  if (!parsed.success) return c.json({ error: "Invalid response", details: parsed.error.format() }, 500);
  return c.json(parsed.data);
});

workflowRoute.post("/:id/planner/regenerate", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = RegeneratePlannerRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const run = await getWorkflowRun(id);
  if (!run) return c.json({ error: "Workflow not found" }, 404);
  if (run.status !== "WAITING_FOR_HUMAN") {
    return c.json({ error: `Workflow must be WAITING_FOR_HUMAN (current: ${run.status})` }, 409);
  }
  const planner = await getWorkflowStep(id, "PLANNER");
  if (!planner || planner.currentVersion == null) {
    return c.json({ error: "Planner has no completed version to regenerate from" }, 409);
  }

  await updateWorkflowStep(planner.id, { status: "QUEUED", errorMessage: null });
  await updateWorkflowRun(id, { status: "RUNNING", currentStep: "PLANNER" });
  await logEvent({
    workflowRunId: id,
    type: "planner.regenerate.requested",
    message: `Planner regenerate requested for workflow ${id}`,
    metadataJson: { feedback: parsedBody.data.feedback, baseVersion: planner.currentVersion },
  });
  await boss.send(
    WORKFLOW_QUEUES.PLANNER,
    {
      workflowRunId: id,
      feedback: parsedBody.data.feedback,
      baseVersion: planner.currentVersion,
    } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );
  return c.json({ ok: true, baseVersion: planner.currentVersion });
});

workflowRoute.post("/:id/planner/approve", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = ApprovePlannerRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const run = await getWorkflowRun(id);
  if (!run) return c.json({ error: "Workflow not found" }, 404);
  if (run.status !== "WAITING_FOR_HUMAN") {
    return c.json({ error: `Workflow must be WAITING_FOR_HUMAN (current: ${run.status})` }, 409);
  }
  const planner = await getWorkflowStep(id, "PLANNER");
  if (!planner) return c.json({ error: "Planner step not found" }, 409);
  const versionRow = await getStepVersion(planner.id, parsedBody.data.version);
  if (!versionRow) {
    return c.json({ error: `Planner v${parsedBody.data.version} does not exist` }, 404);
  }

  await updateWorkflowStep(planner.id, {
    status: "COMPLETED",
    approvedVersion: parsedBody.data.version,
  });
  await logEvent({
    workflowRunId: id,
    type: "planner.approved",
    message: `Planner v${parsedBody.data.version} approved for workflow ${id}`,
    metadataJson: { approvedVersion: parsedBody.data.version },
  });

  const writer = await getWorkflowStep(id, "WRITER");
  if (!writer) await createWorkflowStep(id, "WRITER", "QUEUED");
  else await updateWorkflowStep(writer.id, { status: "QUEUED", errorMessage: null });
  await updateWorkflowRun(id, { status: "RUNNING", currentStep: "WRITER" });
  await boss.send(
    WORKFLOW_QUEUES.WRITER,
    { workflowRunId: id } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );
  return c.json({ ok: true, approvedVersion: parsedBody.data.version });
});
