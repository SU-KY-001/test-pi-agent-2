import { Hono } from "hono";
import { log } from "../config/logger";
import {
  ApprovePlannerRequestSchema,
  ContinueStepRequestSchema,
  CreateWorkflowRequestSchema,
  CreateWorkflowResponseSchema,
  DirectEditStepRequestSchema,
  GetWorkflowResponseSchema,
  RegeneratePlannerRequestSchema,
  RerunStepRequestSchema,
  STEP_REVIEW_POLICY,
  StepTypeSchema,
  type StepType,
} from "@repo/contracts";
import { boss } from "../queue/boss";
import {
  createWorkflowRun,
  createWorkflowStep,
  getStepVersions,
  getWorkflowRun,
  listWorkflowSteps,
  logEvent,
  updateWorkflowRun,
} from "../workflow/workflow.repository";
import {
  continueStepWithGuidance,
  directEditStep,
  rerunStepWithFeedback,
} from "../workflow/workflow-transition.service";
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
  log.info({ scope: "workflow", workflowRunId: run.id }, "Workflow created, EXTRACTOR enqueued");

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
        reviewPolicy: STEP_REVIEW_POLICY[s.stepType as StepType] ?? "AUTO_CONTINUE",
        currentVersion: s.currentVersion,
        approvedVersion: s.approvedVersion,
        errorMessage: s.errorMessage,
        incomingGuidance: s.incomingGuidance ?? null,
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

workflowRoute.post("/:id/steps/:type/rerun", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);

  const rawType = c.req.param("type").toUpperCase();
  const parsedType = StepTypeSchema.safeParse(rawType);
  if (!parsedType.success) {
    return c.json({ error: `Invalid step type: ${rawType}` }, 400);
  }

  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = RerunStepRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const result = await rerunStepWithFeedback(id, parsedType.data, parsedBody.data.feedback);
  if (!result.success) {
    return c.json({ error: result.error, details: result.details }, result.status);
  }

  return c.json({ ok: true, stepType: parsedType.data });
});

workflowRoute.post("/:id/steps/:type/continue", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);

  const rawType = c.req.param("type").toUpperCase();
  const parsedType = StepTypeSchema.safeParse(rawType);
  if (!parsedType.success) {
    return c.json({ error: `Invalid step type: ${rawType}` }, 400);
  }

  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = ContinueStepRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const result = await continueStepWithGuidance(
    id,
    parsedType.data,
    parsedBody.data.version,
    parsedBody.data.incomingGuidance
  );
  if (!result.success) {
    return c.json({ error: result.error, details: result.details }, result.status);
  }

  return c.json({ ok: true, stepType: parsedType.data, ...result.data });
});

workflowRoute.post("/:id/steps/:type/direct-edit", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);

  const rawType = c.req.param("type").toUpperCase();
  const parsedType = StepTypeSchema.safeParse(rawType);
  if (!parsedType.success) {
    return c.json({ error: `Invalid step type: ${rawType}` }, 400);
  }

  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = DirectEditStepRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const result = await directEditStep(
    id,
    parsedType.data,
    parsedBody.data.baseVersion,
    parsedBody.data.editedOutputJson,
    parsedBody.data.note
  );
  if (!result.success) {
    return c.json({ error: result.error, details: result.details }, result.status);
  }

  return c.json({ ok: true, stepType: parsedType.data, ...result.data });
});

workflowRoute.post("/:id/planner/regenerate", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = RegeneratePlannerRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const result = await rerunStepWithFeedback(id, "PLANNER", parsedBody.data.feedback);
  if (!result.success) {
    return c.json({ error: result.error, details: result.details }, result.status);
  }

  return c.json({ ok: true, stepType: "PLANNER" });
});

workflowRoute.post("/:id/planner/approve", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = ApprovePlannerRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const result = await continueStepWithGuidance(id, "PLANNER", parsedBody.data.version);
  if (!result.success) {
    return c.json({ error: result.error, details: result.details }, result.status);
  }

  return c.json({ ok: true, approvedVersion: parsedBody.data.version, ...result.data });
});
