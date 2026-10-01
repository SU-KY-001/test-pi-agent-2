import { db, systemEvents } from "@repo/db";
import { log } from "../config/logger";
import { boss } from "./boss";
import {
  DEMO_PING_QUEUE,
  STEP_TYPES,
  WORKFLOW_QUEUES,
  type AgentJobPayload,
  type NarrativeSelectionPayload,
  type StepType,
} from "../workflow/workflow.types";
import { handleAgentStepJob } from "./jobs/agent-step.job";

export interface QueueJob<T = unknown> {
  id: string;
  data?: T;
}

function parseNarrativeSelection(value: unknown): NarrativeSelectionPayload | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const titles = raw.episodeTitles;
  if (
    typeof raw.selectedFocusType !== "string" ||
    typeof raw.seriesTitle !== "string" ||
    !Array.isArray(titles) ||
    titles.length !== 3 ||
    !titles.every((title) => typeof title === "string")
  ) {
    return undefined;
  }
  return {
    selectedFocusType: raw.selectedFocusType,
    seriesTitle: raw.seriesTitle,
    episodeTitles: [titles[0] as string, titles[1] as string, titles[2] as string],
    editorialNotes: typeof raw.editorialNotes === "string" ? raw.editorialNotes : undefined,
  };
}

function parseAgentPayload(job: QueueJob | undefined, expectedStep: StepType): AgentJobPayload | null {
  if (!job || typeof job.data !== "object" || job.data === null) return null;
  const data = job.data as Record<string, unknown>;

  if (typeof data.workflowRunId !== "number") return null;
  if (data.stepType !== expectedStep) return null;
  if (data.parentVersionId !== null && typeof data.parentVersionId !== "number") return null;

  return {
    workflowRunId: data.workflowRunId,
    stepType: expectedStep,
    parentVersionId: data.parentVersionId as number | null,
    guidance: typeof data.guidance === "string" ? data.guidance : undefined,
    narrativeSelection: parseNarrativeSelection(data.narrativeSelection),
  };
}

export async function registerWorkers(): Promise<void> {
  await boss.work(DEMO_PING_QUEUE, async (jobs: QueueJob[]) => {
    const job = jobs[0];
    if (!job) return { success: false };
    log.info({ jobId: job.id, data: job.data }, "[Queue Worker] Processing job");
    await db.insert(systemEvents).values({
      type: "demo-ping",
      message: JSON.stringify(job.data ?? {}),
    });
    return { success: true, jobId: job.id };
  });

  for (const stepType of STEP_TYPES) {
    const queueName = WORKFLOW_QUEUES[stepType];
    await boss.work<AgentJobPayload>(queueName, async (jobs: QueueJob<AgentJobPayload>[]) => {
      const payload = parseAgentPayload(jobs[0], stepType);
      if (!payload) throw new Error(`Invalid ${stepType} job payload: workflowRunId + stepType required`);
      await handleAgentStepJob(payload);
    });
    log.info({ queue: queueName }, "[Queue Worker] Flow 2 agent worker registered");
  }
}
