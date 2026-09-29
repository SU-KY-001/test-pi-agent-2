import { db, systemEvents } from "@repo/db";
import { boss } from "./boss";
import { DEMO_PING_QUEUE, WORKFLOW_QUEUES, type AgentJobPayload } from "../workflow/workflow.types";
import { handleExtractorJob } from "./jobs/extractor.job";
import { handlePlannerJob } from "./jobs/planner.job";
import { handleWriterJob } from "./jobs/writer.job";
import { handleReviewerJob } from "./jobs/reviewer.job";

export interface QueueJob<T = unknown> {
  id: string;
  data?: T;
}

function parseAgentPayload(job: QueueJob | undefined): AgentJobPayload | null {
  if (!job || typeof job.data !== "object" || job.data === null) return null;
  const data = job.data as { workflowRunId?: unknown; feedback?: unknown; baseVersion?: unknown };
  if (typeof data.workflowRunId !== "number") return null;
  return {
    workflowRunId: data.workflowRunId,
    feedback: typeof data.feedback === "string" ? data.feedback : undefined,
    baseVersion: typeof data.baseVersion === "number" ? data.baseVersion : undefined,
  };
}

export async function registerWorkers(): Promise<void> {
  await boss.work(DEMO_PING_QUEUE, async (jobs: QueueJob[]) => {
    const job = jobs[0];
    if (!job) return { success: false };
    console.log(`[Queue Worker] Processing job ${job.id}:`, job.data);
    await db.insert(systemEvents).values({
      type: "demo-ping",
      message: JSON.stringify(job.data ?? {}),
    });
    return { success: true, jobId: job.id };
  });

  await boss.work<AgentJobPayload>(
    WORKFLOW_QUEUES.EXTRACTOR,
    async (jobs: QueueJob<AgentJobPayload>[]) => {
      const payload = parseAgentPayload(jobs[0]);
      if (!payload) throw new Error("Invalid extractor job payload: workflowRunId required");
      await handleExtractorJob(payload);
    }
  );

  await boss.work<AgentJobPayload>(
    WORKFLOW_QUEUES.PLANNER,
    async (jobs: QueueJob<AgentJobPayload>[]) => {
      const payload = parseAgentPayload(jobs[0]);
      if (!payload) throw new Error("Invalid planner job payload: workflowRunId required");
      await handlePlannerJob(payload);
    }
  );

  await boss.work<AgentJobPayload>(
    WORKFLOW_QUEUES.WRITER,
    async (jobs: QueueJob<AgentJobPayload>[]) => {
      const payload = parseAgentPayload(jobs[0]);
      if (!payload) throw new Error("Invalid writer job payload: workflowRunId required");
      await handleWriterJob(payload);
    }
  );

  await boss.work<AgentJobPayload>(
    WORKFLOW_QUEUES.REVIEWER,
    async (jobs: QueueJob<AgentJobPayload>[]) => {
      const payload = parseAgentPayload(jobs[0]);
      if (!payload) throw new Error("Invalid reviewer job payload: workflowRunId required");
      await handleReviewerJob(payload);
    }
  );
}
