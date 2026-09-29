import pino from "pino";
import { env } from "./env";

const REDACT_PATHS = ["OPENCODE_API_KEY", "*.apiKey", "*.token", "*.authorization"];

function createLogger(): pino.Logger {
  const base = { service: "api" };
  // Prod: JSON to stdout, no transport (pino-pretty worker threads break under bun --hot).
  if (env.NODE_ENV === "production") {
    return pino({ level: env.LOG_LEVEL, base, redact: REDACT_PATHS });
  }
  try {
    return pino({
      level: env.LOG_LEVEL,
      base,
      redact: REDACT_PATHS,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    });
  } catch {
    // Transport unavailable (e.g. bun --hot worker constraints): fall back to plain JSON.
    return pino({ level: env.LOG_LEVEL, base, redact: REDACT_PATHS });
  }
}

export const log = createLogger();
