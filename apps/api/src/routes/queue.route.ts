import { Hono } from "hono";
import { boss } from "../queue/boss";
import { DEMO_PING_QUEUE } from "../workflow/workflow.types";
import { QueueTestResponseSchema } from "@repo/contracts";

export const queueRoute = new Hono();

queueRoute.post("/test", async (c) => {
  try {
    const jobId = await boss.send(DEMO_PING_QUEUE, {
      message: "hello queue",
      timestamp: new Date().toISOString(),
    });

    if (!jobId) {
      return c.json({ error: "Failed to enqueue job, no jobId returned" }, 500);
    }

    const payload = { jobId };
    const parsed = QueueTestResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return c.json({ error: "Invalid response format", details: parsed.error.format() }, 500);
    }

    return c.json(parsed.data);
  } catch (err) {
    console.error("Queue test error:", err);
    return c.json({ error: "Failed to send job to queue", details: String(err) }, 500);
  }
});
