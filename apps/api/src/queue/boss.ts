import { PgBoss, fromPglite } from "pg-boss";
import { pglite } from "@repo/db";

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
  await b.createQueue("demo-ping");
  return b;
}

export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
  }
}
