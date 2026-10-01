import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  publishedPodcasts,
  stepVersions,
  systemEvents,
  workflowRuns,
  workflowSteps,
  type NewWorkflowRun,
  type NewWorkflowStep,
} from "@repo/db";
import type { StepStatus, StepType, WorkflowStatus } from "./workflow.types";

export async function createWorkflowRun(topic: string) {
  const inserted = await db
    .insert(workflowRuns)
    .values({
      topic,
      status: "PENDING",
      currentStep: "RESEARCHER",
    } satisfies NewWorkflowRun)
    .returning();
  const run = inserted[0];
  if (!run) throw new Error("Failed to create workflow run");
  return run;
}

export async function getWorkflowRun(id: number) {
  const rows = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id));
  return rows[0] ?? null;
}

export async function updateWorkflowRun(
  id: number,
  patch: { status?: WorkflowStatus; currentStep?: StepType | null; completedAt?: Date | null }
) {
  await db
    .update(workflowRuns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workflowRuns.id, id));
}

export async function getWorkflowStep(workflowRunId: number, stepType: StepType) {
  const rows = await db
    .select()
    .from(workflowSteps)
    .where(
      and(
        eq(workflowSteps.workflowRunId, workflowRunId),
        eq(workflowSteps.stepType, stepType)
      )
    );
  return rows[0] ?? null;
}

export async function createWorkflowStep(
  workflowRunId: number,
  stepType: StepType,
  status: StepStatus = "PENDING"
) {
  const inserted = await db
    .insert(workflowSteps)
    .values({
      workflowRunId,
      stepType,
      status,
    } satisfies NewWorkflowStep)
    .returning();
  const step = inserted[0];
  if (!step) throw new Error(`Failed to create step ${stepType}`);
  return step;
}

/** Lấy step, tạo mới nếu chưa có (pipeline 7 bước chạy dần theo nhánh). */
export async function ensureWorkflowStep(
  workflowRunId: number,
  stepType: StepType,
  status: StepStatus = "PENDING"
) {
  return (await getWorkflowStep(workflowRunId, stepType)) ?? createWorkflowStep(workflowRunId, stepType, status);
}

export async function updateWorkflowStep(
  id: number,
  patch: {
    status?: StepStatus;
    currentVersion?: number | null;
    approvedVersion?: number | null;
    errorMessage?: string | null;
    incomingGuidance?: string | null;
  }
) {
  await db
    .update(workflowSteps)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workflowSteps.id, id));
}

export async function atomicTransitionStepStatus(
  stepId: number,
  expectedStatus: StepStatus,
  expectedVersion: number,
  patch: {
    status: StepStatus;
    approvedVersion?: number | null;
    incomingGuidance?: string | null;
  }
) {
  const rows = await db
    .update(workflowSteps)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(workflowSteps.id, stepId),
        eq(workflowSteps.status, expectedStatus),
        eq(workflowSteps.currentVersion, expectedVersion)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function setDownstreamStepsStale(
  workflowRunId: number,
  downstreamTypes: StepType[]
) {
  if (downstreamTypes.length === 0) return;
  await db
    .update(workflowSteps)
    .set({ status: "STALE", updatedAt: new Date() })
    .where(
      and(
        eq(workflowSteps.workflowRunId, workflowRunId),
        inArray(workflowSteps.stepType, downstreamTypes)
      )
    );
}

export async function getStepVersions(workflowStepId: number) {
  return db
    .select()
    .from(stepVersions)
    .where(eq(stepVersions.workflowStepId, workflowStepId))
    .orderBy(desc(stepVersions.version));
}

export async function getStepVersion(workflowStepId: number, version: number) {
  const rows = await db
    .select()
    .from(stepVersions)
    .where(
      and(
        eq(stepVersions.workflowStepId, workflowStepId),
        eq(stepVersions.version, version)
      )
    );
  return rows[0] ?? null;
}

/** Node theo id, kèm stepType của nó — đơn vị duyệt của Cây Lịch sử Thực thi. */
export async function getStepVersionById(id: number) {
  const rows = await db
    .select({ node: stepVersions, stepType: workflowSteps.stepType })
    .from(stepVersions)
    .innerJoin(workflowSteps, eq(stepVersions.workflowStepId, workflowSteps.id))
    .where(eq(stepVersions.id, id));
  return rows[0] ?? null;
}

/** Toàn bộ node của một run, sắp theo thời gian tạo (dựng cây ở client). */
export async function listRunNodes(workflowRunId: number) {
  return db
    .select({ node: stepVersions, stepType: workflowSteps.stepType, stepStatus: workflowSteps.status })
    .from(stepVersions)
    .innerJoin(workflowSteps, eq(stepVersions.workflowStepId, workflowSteps.id))
    .where(eq(workflowSteps.workflowRunId, workflowRunId))
    .orderBy(stepVersions.id);
}

export async function insertStepVersion(values: {
  workflowStepId: number;
  version: number;
  parentVersionId?: number | null;
  inputJson: unknown;
  outputJson: unknown;
  humanFeedback?: string | null;
  validationStatus?: string;
}) {
  const inserted = await db
    .insert(stepVersions)
    .values({
      workflowStepId: values.workflowStepId,
      version: values.version,
      parentVersionId: values.parentVersionId ?? null,
      inputJson: values.inputJson ?? null,
      outputJson: values.outputJson,
      humanFeedback: values.humanFeedback ?? null,
      validationStatus: values.validationStatus ?? "valid",
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Failed to insert step version");
  return row;
}

export async function listWorkflowSteps(workflowRunId: number) {
  return db
    .select()
    .from(workflowSteps)
    .where(eq(workflowSteps.workflowRunId, workflowRunId));
}

export async function insertPublication(values: {
  workflowRunId: number;
  approvedVersionId: number;
  approvedBy: string;
  finalScript: string;
  wordCount: number;
  estimatedDurationSeconds: number;
}) {
  const inserted = await db
    .insert(publishedPodcasts)
    .values(values)
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Failed to insert publication");
  return row;
}

export async function listPublications(workflowRunId: number) {
  return db
    .select()
    .from(publishedPodcasts)
    .where(eq(publishedPodcasts.workflowRunId, workflowRunId))
    .orderBy(desc(publishedPodcasts.id));
}

export async function logEvent(values: {
  workflowRunId?: number | null;
  type: string;
  message: string;
  metadataJson?: unknown;
}) {
  await db.insert(systemEvents).values({
    workflowRunId: values.workflowRunId ?? null,
    type: values.type,
    message: values.message,
    metadataJson: values.metadataJson ?? null,
  });
}
