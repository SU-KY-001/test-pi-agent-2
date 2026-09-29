import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

// Load repo root and local .env if present
const repoRoot = path.resolve(import.meta.dir, "../../../..");
dotenv.config({ path: path.resolve(repoRoot, ".env") });
dotenv.config();

const EnvSchema = z
  .object({
    API_PORT: z.coerce.number().default(3001),
    WEB_URL: z.string().default("http://localhost:3000"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("debug"),
    PGLITE_DATA_DIR: z.string().optional(),
    OPENCODE_API_KEY: z.string().optional(),
    OPENCODE_MODEL: z.string().optional(),
    PI_PROVIDER: z.string().default("opencode-go"),
    PI_MODEL: z.string().optional(),
    PI_THINKING_LEVEL: z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]).default("medium"),
  })
  .transform((data) => ({
    ...data,
    RESOLVED_MODEL: data.PI_MODEL || data.OPENCODE_MODEL || "minimax-m3",
  }));

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
