import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { runMigrations, closePglite } from "@repo/db";
import { initBoss, stopBoss } from "./queue/boss";
import { registerWorkers } from "./queue/workers";
import { piService } from "./pi/pi.service";
import { healthRoute } from "./routes/health.route";
import { queueRoute } from "./routes/queue.route";
import { piRoute } from "./routes/pi.route";
import { workflowRoute } from "./routes/workflow.route";

console.log("🚀 Starting Su Ky Agent Demo API...");

// 1. Env is validated via import
console.log(`[Lifecycle 1/9] Env validated. Port: ${env.API_PORT}`);

// 2 & 3. PGlite singleton and Drizzle are initialized via @repo/db
console.log("[Lifecycle 2/9] PGlite initialized");
console.log("[Lifecycle 3/9] Drizzle ORM connected");

// 4. Run Drizzle migrations
try {
  console.log("[Lifecycle 4/9] Running database migrations...");
  await runMigrations();
  console.log("[Lifecycle 4/9] Migrations completed successfully");
} catch (err) {
  console.error("❌ Fatal: Failed to run migrations:", err);
  await closePglite().catch(() => {});
  process.exit(1);
}

// 5 & 6. Initialize pg-boss and create queues
try {
  console.log("[Lifecycle 5/9] Initializing pg-boss with PGlite backend...");
  await initBoss();
  console.log("[Lifecycle 5/9] pg-boss started");
  console.log("[Lifecycle 6/9] Queue 'demo-ping' verified/created");
} catch (err) {
  console.error("❌ Fatal: Failed to initialize pg-boss:", err);
  await closePglite().catch(() => {});
  process.exit(1);
}

// 7. Register workers
try {
  console.log("[Lifecycle 7/9] Registering queue workers...");
  await registerWorkers();
  console.log("[Lifecycle 7/9] Worker for 'demo-ping' registered");
} catch (err) {
  console.error("❌ Fatal: Failed to register workers:", err);
  await stopBoss().catch(() => {});
  await closePglite().catch(() => {});
  process.exit(1);
}

// 8. Initialize Pi model runtime
try {
  console.log("[Lifecycle 8/9] Initializing Pi model runtime...");
  await piService.init();
  console.log("[Lifecycle 8/9] Pi model runtime initialized");
} catch (err) {
  console.warn("⚠️ Warning: Non-fatal error during Pi runtime init:", err);
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
  activeRequests++;
  try {
    await next();
  } finally {
    activeRequests--;
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
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    console.log("Stopping HTTP server listener (rejecting new connections)...");
    server.stop(false);

    const drainDeadline = Date.now() + 3000;
    while (activeRequests > 0 && Date.now() < drainDeadline) {
      await Bun.sleep(50);
    }

    if (activeRequests > 0) {
      console.warn(`⚠️ Forcefully terminating ${activeRequests} remaining in-flight connections after drain deadline...`);
      server.stop(true);
    } else {
      console.log("HTTP server drained completely with zero active connections.");
    }
    await stopBoss();
    console.log("pg-boss stopped.");

    console.log("Closing PGlite...");
    await closePglite();
    console.log("PGlite closed.");

    console.log("Shutdown complete. Exiting cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("Error during graceful shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

console.log(`[Lifecycle 9/9] Hono server listening on http://localhost:${env.API_PORT}`);

export default server;
