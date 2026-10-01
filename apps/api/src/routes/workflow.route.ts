import { Hono } from "hono";
import { log } from "../config/logger";
import {
  CreatePublicationRequestSchema,
  CreateWorkflowRequestSchema,
  CreateWorkflowResponseSchema,
  GetWorkflowResponseSchema,
  STEP_ORDER,
  StepDecisionRequestSchema,
  WorkflowTreeResponseSchema,
  reviewerFor,
  reviewPolicyFor,
} from "@repo/contracts";
import { boss } from "../queue/boss";
import {
  createWorkflowRun,
  ensureWorkflowStep,
  getStepVersions,
  getWorkflowRun,
  listPublications,
  listRunNodes,
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
  MAX_TOPIC_LENGTH,
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
  const topic = parsed.data.topic.trim();
  if (topic.length > MAX_TOPIC_LENGTH) {
    return c.json({ error: `topic exceeds ${MAX_TOPIC_LENGTH} chars` }, 400);
  }

  const run = await createWorkflowRun(topic);
  await ensureWorkflowStep(run.id, "RESEARCHER", "QUEUED");
  await updateWorkflowRun(run.id, { status: "RUNNING", currentStep: "RESEARCHER" });
  await logEvent({
    workflowRunId: run.id,
    type: "workflow.created",
    message: `Workflow ${run.id} created for topic "${topic}"`,
    metadataJson: { userProvidedSources: parsed.data.userProvidedSources ?? null },
  });
  await boss.send(
    WORKFLOW_QUEUES.RESEARCHER,
    { workflowRunId: run.id, stepType: "RESEARCHER", parentVersionId: null } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );
  log.info({ scope: "workflow", workflowRunId: run.id }, "Workflow created, RESEARCHER enqueued");

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
  const byType = new Map(steps.map((step) => [step.stepType, step]));

  // Trả đủ 7 bước theo STEP_ORDER để dashboard luôn vẽ được toàn pipeline.
  const stepsPayload = await Promise.all(
    STEP_ORDER.map(async (stepType, sortOrder) => {
      const step = byType.get(stepType);
      if (!step) {
        return {
          type: stepType,
          status: "PENDING" as const,
          reviewPolicy: reviewPolicyFor(stepType),
          reviewer: reviewerFor(stepType),
          sortOrder,
          currentVersion: null,
          approvedVersion: null,
          errorMessage: null,
          incomingGuidance: null,
          versions: [],
        };
      }
      const versions = await getStepVersions(step.id);
      return {
        type: stepType,
        status: step.status,
        reviewPolicy: reviewPolicyFor(stepType),
        reviewer: reviewerFor(stepType),
        sortOrder,
        currentVersion: step.currentVersion,
        approvedVersion: step.approvedVersion,
        errorMessage: step.errorMessage,
        incomingGuidance: step.incomingGuidance ?? null,
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          parentVersionId: v.parentVersionId,
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
    topic: run.topic,
    currentStep: run.currentStep,
    steps: stepsPayload,
  };
  const parsed = GetWorkflowResponseSchema.safeParse(payload);
  if (!parsed.success) return c.json({ error: "Invalid response", details: parsed.error.format() }, 500);
  return c.json(parsed.data);
});

/** Cây Lịch sử Thực thi: mọi node bất biến + các bản ghi xuất bản của run. */
workflowRoute.get("/:id/tree", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);
  const run = await getWorkflowRun(id);
  if (!run) return c.json({ error: "Workflow not found" }, 404);

  const [nodes, publications] = await Promise.all([listRunNodes(id), listPublications(id)]);
  const steps = await listWorkflowSteps(id);
  const statusByStepId = new Map(steps.map((step) => [step.id, step.status]));

  const payload = {
    workflowRunId: id,
    nodes: nodes.map((row) => ({
      id: row.node.id,
      stepType: row.stepType,
      version: row.node.version,
      parentVersionId: row.node.parentVersionId,
      status: statusByStepId.get(row.node.workflowStepId) ?? "PENDING",
      approved: false,
      createdAt: row.node.createdAt?.toISOString() ?? "",
    })),
    publications: publications.map((row) => ({
      id: row.id,
      approvedVersionId: row.approvedVersionId,
      totalWords: row.wordCount,
      estimatedDurationSeconds: row.estimatedDurationSeconds,
      publishedAt: row.publishedAt?.toISOString() ?? "",
    })),
  };
  const parsed = WorkflowTreeResponseSchema.safeParse(payload);
  if (!parsed.success) return c.json({ error: "Invalid response", details: parsed.error.format() }, 500);
  return c.json(parsed.data);
});

/**
 * Một endpoint cho mọi quyết định của Moderator trên một node.
 * `stepType` nằm trong body vì đó là dữ liệu của quyết định, không phải định danh tài nguyên.
 */
workflowRoute.post("/:id/step-decisions", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);

  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = StepDecisionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  const decision = parsedBody.data;

  switch (decision.action) {
    case "CONTINUE": {
      const result = await continueStepWithGuidance(
        id,
        decision.stepType,
        decision.baseVersion,
        decision.incomingGuidance,
        decision.narrativeSelection
      );
      if (!result.success) return c.json({ error: result.error, details: result.details }, result.status);
      return c.json({ ok: true, stepType: decision.stepType, action: decision.action, ...result.data });
    }
    case "RERUN": {
      const result = await rerunStepWithFeedback(id, decision.stepType, decision.feedback);
      if (!result.success) return c.json({ error: result.error, details: result.details }, result.status);
      return c.json({ ok: true, stepType: decision.stepType, action: decision.action });
    }
    case "DIRECT_EDIT": {
      const result = await directEditStep(
        id,
        decision.stepType,
        decision.baseVersion,
        decision.editedOutputJson,
        decision.note
      );
      if (!result.success) return c.json({ error: result.error, details: result.details }, result.status);
      return c.json({ ok: true, stepType: decision.stepType, action: decision.action, ...result.data });
    }
  }
});

/** Tạo bản ghi xuất bản từ một node đã được Moderator duyệt. */
workflowRoute.post("/:id/publications", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid workflow id" }, 400);

  const body: unknown = await c.req.json().catch(() => null);
  const parsedBody = CreatePublicationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json({ error: "Invalid request", details: parsedBody.error.format() }, 400);
  }

  try {
    const { publishFromApprovedNode } = await import("../workflow/publication.service");
    const publication = await publishFromApprovedNode({
      workflowRunId: id,
      approvedVersionId: parsedBody.data.approvedVersionId,
      approvedBy: parsedBody.data.approvedBy,
    });
    return c.json({ ok: true, publicationId: publication.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return c.json({ error: message }, 400);
  }
});
