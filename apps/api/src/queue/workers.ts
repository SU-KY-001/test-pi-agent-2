import { boss } from "./boss";
import { db, systemEvents } from "@repo/db";

export interface QueueJob {
  id: string;
  data?: unknown;
}

export async function registerWorkers(): Promise<void> {
  await boss.work("demo-ping", async (jobs: QueueJob[]) => {
    const job = jobs[0];
    if (!job) return { success: false };
    console.log(`[Queue Worker] Processing job ${job.id}:`, job.data);
    await db.insert(systemEvents).values({
      type: "demo-ping",
      message: JSON.stringify(job.data ?? {}),
    });
    return { success: true, jobId: job.id };
  });
}
