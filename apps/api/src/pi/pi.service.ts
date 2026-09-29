import { ModelRuntime, SessionManager, createAgentSession } from "@earendil-works/pi-coding-agent";
import { env } from "../config/env";
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
      if (env.OPENCODE_API_KEY) {
        this.modelRuntime.setRuntimeApiKey("opencode-go", env.OPENCODE_API_KEY);
      }
      const targetModelName = env.RESOLVED_MODEL;
      const resolvedModel = this.modelRuntime.getModel(env.PI_PROVIDER, targetModelName);
      if (resolvedModel) {
        this.model = { id: resolvedModel.id };
      } else {
        const available = this.modelRuntime.getModels(env.PI_PROVIDER);
        if (available && available.length > 0 && available[0]) {
          this.model = { id: available[0].id };
          console.warn(`⚠️ Warning: Model "${targetModelName}" not found. Falling back to "${this.model.id}".`);
        } else {
          console.warn(`⚠️ Warning: No models found for provider "${env.PI_PROVIDER}".`);
        }
      }
      this.isReady = !!(this.model && (env.OPENCODE_API_KEY || process.env.OPENCODE_API_KEY));
      console.log(`[PiService] Initialized. Provider: ${env.PI_PROVIDER}, Model: ${this.model?.id ?? "none"}, Ready: ${this.isReady}`);
    } catch (err) {
      console.error("❌ Failed to initialize PiService:", err);
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

    // Ephemeral session with strictly empty tools: no coding tools, no bash, no filesystem, no MCP
    const sessionResult = await createAgentSession({
      model: liveModel,
      modelRuntime: this.modelRuntime,
      sessionManager: SessionManager.inMemory(),
      tools: [],
    });

    const session = sessionResult.session;

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

      return {
        ok: true,
        provider: env.PI_PROVIDER,
        model: this.model.id,
        response: responseText.trim() || "PONG",
      };
    } finally {
      await session.dispose();
    }
  }
}

export const piService = PiService.getInstance();
