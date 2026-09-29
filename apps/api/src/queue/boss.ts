import { PgBoss, fromPglite } from "pg-boss";
import { pglite } from "@repo/db";
import { DEMO_PING_QUEUE, WORKFLOW_QUEUES } from "../workflow/workflow.types";

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

export async function initBoss(): Promise<PgBoss> {
  const b = getBoss();
  await b.start();
  await b.createQueue(DEMO_PING_QUEUE);
  await b.createQueue(WORKFLOW_QUEUES.EXTRACTOR);
  await b.createQueue(WORKFLOW_QUEUES.PLANNER);
  await b.createQueue(WORKFLOW_QUEUES.WRITER);
  await b.createQueue(WORKFLOW_QUEUES.REVIEWER);
  return b;
}

export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
  }
}
