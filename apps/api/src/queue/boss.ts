import { PgBoss, fromPglite } from "pg-boss";
import { pglite } from "@repo/db";
import { DEMO_PING_QUEUE, STEP_TYPES, WORKFLOW_QUEUES } from "../workflow/workflow.types";

let bossInstance: PgBoss | null = null;

export function getBoss(): PgBoss {
  if (!bossInstance) {
    bossInstance = new PgBoss({
      db: fromPglite(pglite),
    });
  }
  return bossInstance;
}

export const boss = getBoss();

export const WORKFLOW_QUEUE_NAMES: readonly string[] = STEP_TYPES.map(
  (stepType) => WORKFLOW_QUEUES[stepType]
);

export async function initBoss(): Promise<PgBoss> {
  const b = getBoss();
  await b.start();
  await b.createQueue(DEMO_PING_QUEUE);
  for (const queueName of WORKFLOW_QUEUE_NAMES) {
    await b.createQueue(queueName);
  }
  return b;
}

export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
  }
}
