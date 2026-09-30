import pino from "pino";
import pretty from "pino-pretty";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env";

const REDACT_PATHS = ["OPENCODE_API_KEY", "*.apiKey", "*.token", "*.authorization"];

const repoRoot = path.resolve(import.meta.dir, "../../../..");
export const logDir = process.env.LOG_DIR
  ? (path.isAbsolute(process.env.LOG_DIR)
      ? process.env.LOG_DIR
      : path.resolve(repoRoot, process.env.LOG_DIR))
  : path.resolve(repoRoot, "log");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export class AppendLogWriter {
  private stream: fs.WriteStream | null = null;
  private currentBytes = 0;

  constructor(public readonly filePath: string, private maxBytes: number = 10 * 1024 * 1024) {
    this.initStream();
  }

  private initStream(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(this.filePath)) {
      try {
        const stat = fs.statSync(this.filePath);
        this.currentBytes = stat.size;
      } catch {
        this.currentBytes = 0;
      }
    }
    this.stream = fs.createWriteStream(this.filePath, { flags: "a", encoding: "utf-8" });
  }

  write(entry: string): void {
    const formatted = entry.endsWith("\n") ? entry : `${entry}\n`;
    const byteLength = Buffer.byteLength(formatted, "utf-8");

    // Rotate if log exceeds maxBytes
    if (this.currentBytes + byteLength > this.maxBytes) {
      try {
        this.stream?.end();
        const backupPath = `${this.filePath}.old`;
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        if (fs.existsSync(this.filePath)) {
          fs.renameSync(this.filePath, backupPath);
        }
      } catch (err) {
        console.error(`[AppendLogWriter] Rotation error for ${this.filePath}:`, err);
      }
      this.currentBytes = 0;
      this.stream = fs.createWriteStream(this.filePath, { flags: "a", encoding: "utf-8" });
    }

    this.currentBytes += byteLength;
    this.stream?.write(formatted);
  }
}

// Backward-compatible alias
export { AppendLogWriter as PrependLogWriter };

export const errorLogWriter = new AppendLogWriter(path.resolve(logDir, "error.log"));
export const successLogWriter = new AppendLogWriter(path.resolve(logDir, "success.log"));

export function formatLogEntry(data: Record<string, unknown>): string {
  const time = data.time ? new Date(Number(data.time)).toISOString() : new Date().toISOString();
  const levelNum = Number(data.level ?? 30);
  const levelStr =
    levelNum >= 60 ? "FATAL" :
    levelNum >= 50 ? "ERROR" :
    levelNum >= 40 ? "WARN" :
    levelNum >= 30 ? "INFO" : "DEBUG";

  const scope = data.scope ? `[${data.scope}]` : `[api]`;
  const msg = String(data.msg ?? "");

  const parts: string[] = [
    "================================================================================",
    `[${time}] [${levelStr}] ${scope} ${msg}`,
  ];

  const contextParts: string[] = [];
  if (data.workflowRunId != null) contextParts.push(`Workflow: #${data.workflowRunId}`);
  if (data.step != null) contextParts.push(`Step: ${data.step}`);
  if (data.model != null) contextParts.push(`Model: ${data.model}`);
  if (data.durationMs != null) contextParts.push(`Duration: ${data.durationMs}ms`);
  if (data.attempt != null) contextParts.push(`Attempt: ${data.attempt}`);
  if (contextParts.length > 0) {
    parts.push(contextParts.join(" | "));
  }

  if (data.err) {
    const err = data.err as Record<string, unknown>;
    if (typeof err === "object" && err !== null) {
      parts.push(`Error: ${err.name || err.type || "Error"}: ${err.message || ""}`);
      if (err.stack) parts.push(`Stack: ${err.stack}`);
    } else {
      parts.push(`Error: ${String(err)}`);
    }
  }

  const standardFields = new Set([
    "time", "level", "pid", "hostname", "service", "msg", "v",
    "scope", "workflowRunId", "step", "model", "durationMs", "attempt", "err"
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!standardFields.has(k)) {
      extra[k] = v;
    }
  }
  if (Object.keys(extra).length > 0) {
    parts.push(`Details: ${JSON.stringify(extra, null, 2)}`);
  }
  parts.push("");
  return parts.join("\n");
}

function createLogger(): pino.Logger {
  const base = { service: "api" };

  const fileStream = {
    write(raw: string) {
      try {
        const data = JSON.parse(raw);
        const levelNum = Number(data.level ?? 30);
        // Skip routine successful HTTP request logs in log files (console still displays them)
        if (data.scope === "http" && levelNum < 40) {
          return;
        }
        const isError = levelNum >= 40 || Boolean(data.err);
        const entry = formatLogEntry(data);
        if (isError) {
          errorLogWriter.write(entry);
        } else {
          successLogWriter.write(entry);
        }
      } catch {
        // Fallback for unparseable chunks
        successLogWriter.write(raw);
      }
    },
  };

  let consoleStream: pino.DestinationStream = process.stdout;
  if (env.NODE_ENV !== "production") {
    try {
      consoleStream = pretty({
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      });
    } catch {
      consoleStream = process.stdout;
    }
  }

  const streams = pino.multistream([
    { stream: consoleStream, level: env.LOG_LEVEL as pino.LevelWithSilent },
    { stream: fileStream, level: env.LOG_LEVEL as pino.LevelWithSilent },
  ]);

  return pino({ level: env.LOG_LEVEL, base, redact: REDACT_PATHS }, streams);
}

export const log = createLogger();
