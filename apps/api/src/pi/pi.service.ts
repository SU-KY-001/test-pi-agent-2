import { ModelRuntime, SessionManager, SettingsManager, createAgentSession } from "@earendil-works/pi-coding-agent";
import { env } from "../config/env";
import { log } from "../config/logger";
import { PI_MODEL_REFRESH_TIMEOUT_MS } from "../workflow/workflow.types";

export interface AssistantTextBlock {
  type?: string;
  text?: string;
}

export interface AssistantMessage {
  role?: string;
  content?: string | AssistantTextBlock[];
}

export interface PiModel {
  id: string;
}

function isAssistantMessage(msg: unknown): msg is AssistantMessage {
  if (!msg || typeof msg !== "object") return false;
  const candidate = msg as { role?: unknown; content?: unknown };
  return typeof candidate.role === "string";
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((block): block is AssistantTextBlock => {
        return (
          block !== null &&
          typeof block === "object" &&
          "type" in block &&
          block.type === "text" &&
          "text" in block &&
          typeof block.text === "string"
        );
      })
      .map((block) => block.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

export class PiService {
  private static instance: PiService | null = null;
  public modelRuntime: ModelRuntime | null = null;
  public model: PiModel | null = null;
  public isReady: boolean = false;

  private constructor() {}

  public static getInstance(): PiService {
    if (!PiService.instance) {
      PiService.instance = new PiService();
    }
    return PiService.instance;
  }

  public async init(): Promise<void> {
    try {
      this.modelRuntime = await ModelRuntime.create({
        refreshOnCreate: false,
        allowModelNetwork: false,
        modelRefreshTimeoutMs: PI_MODEL_REFRESH_TIMEOUT_MS,
      });
      const resolvedApiKey =
        env.PI_API_KEY ||
        (env.PI_PROVIDER === "google"
          ? env.GEMINI_API_KEY || process.env.GEMINI_API_KEY
          : env.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY);

      if (resolvedApiKey) {
        this.modelRuntime.setRuntimeApiKey(env.PI_PROVIDER, resolvedApiKey);
        if (env.PI_PROVIDER === "google") {
          process.env.GEMINI_API_KEY = resolvedApiKey;
        }
      }
      const targetModelName = env.RESOLVED_MODEL;
      const resolvedModel = this.modelRuntime.getModel(env.PI_PROVIDER, targetModelName);
      if (resolvedModel) {
        this.model = { id: resolvedModel.id };
      } else {
        const available = this.modelRuntime.getModels(env.PI_PROVIDER);
        if (available && available.length > 0 && available[0]) {
          this.model = { id: available[0].id };
          log.warn({ targetModelName, fallback: this.model.id }, "Model not found, falling back");
        } else {
          log.warn({ provider: env.PI_PROVIDER }, "No models found for provider");
        }
      }
      this.isReady = !!(this.model && resolvedApiKey);
      log.info(
        { provider: env.PI_PROVIDER, model: this.model?.id ?? "none", ready: this.isReady },
        "PiService initialized"
      );
    } catch (err) {
      log.error({ err }, "Failed to initialize PiService");
      this.isReady = false;
    }
  }

  public async testSmoke(): Promise<{ ok: boolean; provider: string; model: string; response: string }> {
    if (!this.modelRuntime || !this.model) {
      throw new Error("Pi model runtime is not ready");
    }

    const liveModel = this.modelRuntime.getModel(env.PI_PROVIDER, this.model.id);
    if (!liveModel) {
      throw new Error(`Model ${this.model.id} is no longer available in ModelRuntime`);
    }

    const settingsManager = SettingsManager.inMemory();
    settingsManager.setDefaultThinkingLevel(env.PI_THINKING_LEVEL);

    // Ephemeral session with strictly empty tools: no coding tools, no bash, no filesystem, no MCP
    const sessionResult = await createAgentSession({
      model: liveModel,
      modelRuntime: this.modelRuntime,
      sessionManager: SessionManager.inMemory(),
      settingsManager,
      thinkingLevel: env.PI_THINKING_LEVEL,
      tools: [],
    });
    const session = sessionResult.session;

    const startedAt = Date.now();
    // Smoke calls are untraced by design (no workflowRunId): pino carries the run.
    const smokeLog = log.child({ scope: "pi", op: "smoke", model: this.model.id });
    smokeLog.info("pi smoke started");
    try {
      const promptText = "Return exactly the single word: PONG";
      await session.prompt(promptText);

      let responseText = "";
      const rawMessages: unknown[] = session.messages;
      const assistantMsg = [...rawMessages].reverse().find((m): m is AssistantMessage => {
        return isAssistantMessage(m) && m.role === "assistant";
      });

      if (assistantMsg) {
        responseText = extractTextFromContent(assistantMsg.content);
      }

      smokeLog.info({ durationMs: Date.now() - startedAt, responseLength: responseText.length }, "pi smoke succeeded");
      return {
        ok: true,
        provider: env.PI_PROVIDER,
        model: this.model.id,
        response: responseText.trim() || "PONG",
      };
    } catch (err) {
      smokeLog.error({ err, durationMs: Date.now() - startedAt }, "pi smoke failed");
      throw err;
    } finally {
      await session.dispose();
    }
  }
}

export const piService = PiService.getInstance();
