import { Hono } from "hono";
import { pglite } from "@repo/db";
import { boss } from "../queue/boss";
import { piService } from "../pi/pi.service";
import { HealthResponseSchema } from "@repo/contracts";

export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  let dbOk = false;
  try {
    const res = await pglite.query("SELECT 1 as ok;");
    dbOk = Array.isArray(res?.rows) && res.rows.length > 0;
  } catch (err) {
    console.error("Database health check failed:", err);
  }

  let queueOk = false;
  try {
    const queue = await boss.getQueue("demo-ping");
    queueOk = !!queue;
  } catch (err) {
    console.error("Queue health check failed:", err);
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
