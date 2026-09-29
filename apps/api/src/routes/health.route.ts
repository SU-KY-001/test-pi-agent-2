import { Hono } from "hono";
import { pglite } from "@repo/db";
import { boss } from "../queue/boss";
import { log } from "../config/logger";
import { piService } from "../pi/pi.service";
import { HealthResponseSchema } from "@repo/contracts";

export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  let dbOk = false;
  try {
    const res = await pglite.query("SELECT 1 as ok;");
    dbOk = Array.isArray(res?.rows) && res.rows.length > 0;
  } catch (err) {
    log.error({ err }, "Database health check failed");
  }

  let queueOk = false;
  try {
    const queue = await boss.getQueue("demo-ping");
    queueOk = !!queue;
  } catch (err) {
    log.error({ err }, "Queue health check failed");
  }

  const piOk = piService.isReady;

  const responsePayload = {
    status: "ok" as const,
    services: {
      api: true,
      database: dbOk,
      queue: queueOk,
      pi: piOk,
    },
  };

  const parsed = HealthResponseSchema.safeParse(responsePayload);
  if (!parsed.success) {
    return c.json({ error: "Invalid health payload", details: parsed.error.format() }, 500);
  }

  return c.json(parsed.data);
});
