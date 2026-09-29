import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { log } from "./config/logger";
import { runMigrations, closePglite } from "@repo/db";
import { initBoss, stopBoss } from "./queue/boss";
import { registerWorkers } from "./queue/workers";
import { piService } from "./pi/pi.service";
import { healthRoute } from "./routes/health.route";
import { queueRoute } from "./routes/queue.route";
import { piRoute } from "./routes/pi.route";
import { workflowRoute } from "./routes/workflow.route";
import { eventsRoute } from "./routes/events.route";
import { SHUTDOWN_DRAIN_TIMEOUT_MS, SHUTDOWN_POLL_INTERVAL_MS } from "./workflow/workflow.types";

log.info("Starting Su Ky Agent Demo API...");

// 1. Env is validated via import
log.info({ port: env.API_PORT }, "[Lifecycle 1/9] Env validated");

// 2 & 3. PGlite singleton and Drizzle are initialized via @repo/db
log.info("[Lifecycle 2/9] PGlite initialized");
log.info("[Lifecycle 3/9] Drizzle ORM connected");

// 4. Run Drizzle migrations
try {
  log.info("[Lifecycle 4/9] Running database migrations...");
  await runMigrations();
  log.info("[Lifecycle 4/9] Migrations completed successfully");
} catch (err) {
  log.fatal({ err }, "Failed to run migrations");
  await closePglite().catch(() => {});
  process.exit(1);
}

// 5 & 6. Initialize pg-boss and create queues
try {
  log.info("[Lifecycle 5/9] Initializing pg-boss with PGlite backend...");
  await initBoss();
  log.info("[Lifecycle 5/9] pg-boss started");
  log.info("[Lifecycle 6/9] Queue 'demo-ping' verified/created");
} catch (err) {
  log.fatal({ err }, "Failed to initialize pg-boss");
  await closePglite().catch(() => {});
  process.exit(1);
}

// 7. Register workers
try {
  log.info("[Lifecycle 7/9] Registering queue workers...");
  await registerWorkers();
  log.info("[Lifecycle 7/9] Worker for 'demo-ping' registered");
} catch (err) {
  log.fatal({ err }, "Failed to register workers");
  await stopBoss().catch(() => {});
  await closePglite().catch(() => {});
  process.exit(1);
}

// 8. Initialize Pi model runtime
try {
  log.info("[Lifecycle 8/9] Initializing Pi model runtime...");
  await piService.init();
  log.info("[Lifecycle 8/9] Pi model runtime initialized");
} catch (err) {
  log.warn({ err }, "Non-fatal error during Pi runtime init");
}

// 9. Start Hono server
const app = new Hono();

let isShuttingDown = false;
let activeRequests = 0;

// Rejection / draining middleware
app.use("*", async (c, next) => {
  if (isShuttingDown) {
    return c.text("Service is shutting down", 503);
  }
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.header("x-request-id", requestId);
  activeRequests++;
  const startedAt = Date.now();
  try {
    await next();
  } finally {
    activeRequests--;
    log.info(
      { requestId, method: c.req.method, path: c.req.path, status: c.res.status, durationMs: Date.now() - startedAt },
      "http request"
    );
  }
});

// CORS middleware
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1") || origin === env.WEB_URL) {
        return origin || "*";
      }
      return env.WEB_URL;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.route("/health", healthRoute);
app.route("/queue", queueRoute);
app.route("/pi", piRoute);
app.route("/workflows", workflowRoute);
app.route("/events", eventsRoute);

app.get("/", (c) => {
  return c.text("Su Ky Agent Demo API is running");
});

// Own the Bun server instance directly
const server = Bun.serve({
  port: env.API_PORT,
  fetch: app.fetch,
});

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

  try {
    log.info("Stopping HTTP server listener (rejecting new connections)...");
    server.stop(false);

    const drainDeadline = Date.now() + SHUTDOWN_DRAIN_TIMEOUT_MS;
    while (activeRequests > 0 && Date.now() < drainDeadline) {
      await Bun.sleep(SHUTDOWN_POLL_INTERVAL_MS);
    }

    if (activeRequests > 0) {
      log.warn({ activeRequests }, "Forcefully terminating remaining in-flight connections after drain deadline...");
      server.stop(true);
    } else {
      log.info("HTTP server drained completely with zero active connections.");
    }
    await stopBoss();
    log.info("pg-boss stopped.");

    log.info("Closing PGlite...");
    await closePglite();
    log.info("PGlite closed.");

    log.info("Shutdown complete. Exiting cleanly.");
    process.exit(0);
  } catch (err) {
    log.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

log.info({ port: env.API_PORT }, "[Lifecycle 9/9] Hono server listening");

export default server;
