import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, asc, desc, eq, gt, like } from "drizzle-orm";
import { db, systemEvents } from "@repo/db";
import { GetWorkflowEventsResponseSchema } from "@repo/contracts";
import { log } from "../config/logger";
import { getWorkflowRun } from "../workflow/workflow.repository";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, MAX_LIMIT);
}

/**
 * Why: Pi runs stream dozens of trace rows per step. This endpoint replays
 * them per workflow (optionally filtered by type prefix) so the UI can show
 * what the agent actually did instead of just final status + output.
 */
export const eventsRoute = new Hono();

eventsRoute.get("/", async (c) => {
  const workflowRunId = Number(c.req.query("workflowRunId"));
  if (!Number.isInteger(workflowRunId) || workflowRunId <= 0) {
    return c.json({ error: "workflowRunId query param must be a positive integer" }, 400);
  }
  const typePrefix = c.req.query("type") ?? undefined;
  const limit = parsePositiveInt(c.req.query("limit"), DEFAULT_LIMIT);

  try {
    const conditions = [eq(systemEvents.workflowRunId, workflowRunId)];
    if (typePrefix && typePrefix.length > 0) {
      conditions.push(like(systemEvents.type, `${typePrefix}%`));
    }
    const rows = await db
      .select()
      .from(systemEvents)
      .where(and(...conditions))
      .orderBy(desc(systemEvents.id))
      .limit(limit);
    const payload = {
      workflowRunId,
      count: rows.length,
      events: [...rows].reverse().map((r) => ({
        id: r.id,
        type: r.type,
        message: r.message,
        metadataJson: r.metadataJson,
        createdAt: r.createdAt?.toISOString() ?? "",
      })),
    };
    const validated = GetWorkflowEventsResponseSchema.safeParse(payload);
    if (!validated.success) {
      log.error({ issues: validated.error.issues, workflowRunId }, "events response failed contract");
      return c.json({ error: "Events response failed validation" }, 500);
    }
    return c.json(validated.data);
  } catch (err) {
    log.error({ err, workflowRunId }, "events query failed");
    return c.json({ error: "Failed to query events" }, 500);
  }
});
const SSE_HEARTBEAT_MS = 15000;
const SSE_POLL_MS = 1000;

/**
 * Why: poll 1.5s trả cả batch cũ mỗi lần. SSE chỉ push row mới
 * (cursor afterId), đóng khi workflow terminal. Hono streamSSE giữ
 * single-flight, client EventSource reconnect bằng Last-Event-ID.
 */
eventsRoute.get("/stream", async (c) => {
  const workflowRunId = Number(c.req.query("workflowRunId"));
  if (!Number.isInteger(workflowRunId) || workflowRunId <= 0) {
    return c.json({ error: "workflowRunId query param must be a positive integer" }, 400);
  }
  let afterId = Number(c.req.query("afterId") ?? c.req.header("last-event-id") ?? 0);
  if (!Number.isInteger(afterId) || afterId < 0) afterId = 0;

  return streamSSE(c, async (stream) => {
    let heartbeat: ReturnType<typeof setTimeout> | undefined;
    try {
      heartbeat = setInterval(() => {
        void stream.writeSSE({ event: "ping", data: "keepalive" });
      }, SSE_HEARTBEAT_MS);
      while (!stream.closed && !stream.aborted) {
        const rows = await db
          .select()
          .from(systemEvents)
          .where(and(eq(systemEvents.workflowRunId, workflowRunId), gt(systemEvents.id, afterId)))
          .orderBy(asc(systemEvents.id))
          .limit(MAX_LIMIT);
        for (const r of rows) {
          afterId = r.id;
          await stream.writeSSE({
            event: "workflow-event",
            id: String(r.id),
            data: JSON.stringify({
              id: r.id,
              type: r.type,
              message: r.message,
              metadataJson: r.metadataJson,
              createdAt: r.createdAt?.toISOString() ?? "",
            }),
          });
        }
        try {
          const run = await getWorkflowRun(workflowRunId);
          if (run && (run.status === "COMPLETED" || run.status === "FAILED")) {
            await stream.writeSSE({
              event: "workflow-done",
              data: JSON.stringify({ workflowRunId, status: run.status }),
            });
            break;
          }
        } catch (err) {
          log.warn({ err, workflowRunId }, "sse terminal check failed");
        }
        await stream.sleep(SSE_POLL_MS);
      }
    } catch (err) {
      log.warn({ err, workflowRunId }, "sse stream ended");
    } finally {
      clearInterval(heartbeat);
    }
  });
});
