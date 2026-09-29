import { z } from "zod";
import {
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from "@earendil-works/pi-coding-agent";
import { piService } from "../pi/pi.service";
import { buildSchemaRetryPrompt } from "./prompts";
import { MAX_AGENT_RETRY_COUNT } from "../workflow/workflow.types";

export interface AgentTextBlock {
  type?: string;
  text?: string;
}

export interface AgentMessage {
  role?: string;
  content?: string | AgentTextBlock[];
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "object" && b !== null && "text" in b ? String((b as AgentTextBlock).text ?? "") : ""))
      .join("\n");
  }
  return "";
}

function getAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as AgentMessage | null;
    if (m && typeof m === "object" && m.role === "assistant") {
      return extractText(m.content);
    }
  }
  return "";
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

export class AgentValidationError extends Error {
  readonly errors: string;
  constructor(message: string, errors: string) {
    super(message);
    this.name = "AgentValidationError";
    this.errors = errors;
  }
}

/**
 * Why: backend owns schema enforcement. Pi is an LLM harness only —
 * parse + Zod.validate here, retry once with validation errors, then fail.
 */
export async function runStructuredAgent<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  if (!piService.modelRuntime || !piService.model) {
    throw new Error("Pi model runtime is not ready");
  }
  const liveModel = piService.modelRuntime.getModel("opencode-go", piService.model.id);
  if (!liveModel) throw new Error(`Model ${piService.model.id} is no longer available`);

  // Minimal resource surface: no skills, no extensions, no context files.
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: process.cwd(),
    settingsManager: SettingsManager.inMemory(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    model: liveModel,
    modelRuntime: piService.modelRuntime,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory(),
    resourceLoader,
    tools: [],
    noTools: "all",
  });

  try {
    await session.prompt(userPrompt);
    let raw = getAssistantText(session.messages as unknown[]);

    for (let attempt = 0; attempt <= MAX_AGENT_RETRY_COUNT; attempt++) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(extractJson(raw));
      } catch {
        if (attempt >= MAX_AGENT_RETRY_COUNT) {
          throw new AgentValidationError("Agent returned invalid JSON", "Response is not valid JSON");
        }
        await session.prompt(buildSchemaRetryPrompt("Response is not valid JSON"));
        raw = getAssistantText(session.messages as unknown[]);
        continue;
      }
      const validated = schema.safeParse(parsedJson);
      if (validated.success) return validated.data;
      if (attempt >= MAX_AGENT_RETRY_COUNT) {
        throw new AgentValidationError(
          "Agent output failed schema validation",
          JSON.stringify(validated.error.issues)
        );
      }
      await session.prompt(buildSchemaRetryPrompt(JSON.stringify(validated.error.issues)));
      raw = getAssistantText(session.messages as unknown[]);
    }
    throw new AgentValidationError("Agent failed after retry", "No valid output produced");
  } finally {
    await session.dispose();
  }
}
