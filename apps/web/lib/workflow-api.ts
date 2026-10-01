import {
  type CreateWorkflowResponse,
  CreateWorkflowResponseSchema,
  type GetWorkflowEventsResponse,
  GetWorkflowEventsResponseSchema,
  type GetWorkflowResponse,
  GetWorkflowResponseSchema,
  type NarrativeFocusSelection,
  type StepType,
  type WorkflowTreeResponse,
  WorkflowTreeResponseSchema,
} from "@repo/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function readErrorMessage(data: unknown, statusText: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const raw = (data as { error: unknown }).error;
    if (raw != null) return String(raw);
  }
  return statusText;
}

async function requestJson<T>(
  res: Response,
  parse: (data: unknown) => { success: boolean; data?: T },
  label: string
): Promise<T> {
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${readErrorMessage(data, res.statusText)}`);
  }
  const parsed = parse(data);
  if (!parsed.success || parsed.data == null) throw new Error(`Invalid ${label} response schema`);
  return parsed.data;
}

async function requestOk(res: Response, label: string): Promise<unknown> {
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${readErrorMessage(data, res.statusText)}`);
  }
  return data;
}

export async function createWorkflow(topic: string): Promise<CreateWorkflowResponse> {
  const res = await fetch(`${API_BASE_URL}/workflows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  return requestJson(res, (d) => CreateWorkflowResponseSchema.safeParse(d), "Create workflow");
}

export async function fetchWorkflow(id: number): Promise<GetWorkflowResponse> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}`, { cache: "no-store" });
  return requestJson(res, (d) => GetWorkflowResponseSchema.safeParse(d), "Fetch workflow");
}

export async function fetchWorkflowTree(id: number): Promise<WorkflowTreeResponse> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/tree`, { cache: "no-store" });
  return requestJson(res, (d) => WorkflowTreeResponseSchema.safeParse(d), "Fetch execution tree");
}

export async function fetchWorkflowEvents(id: number, limit = 200): Promise<GetWorkflowEventsResponse> {
  const res = await fetch(`${API_BASE_URL}/events?workflowRunId=${id}&limit=${limit}`, { cache: "no-store" });
  return requestJson(res, (d) => GetWorkflowEventsResponseSchema.safeParse(d), "Fetch workflow events");
}

export interface ContinueStepOptions {
  incomingGuidance?: string;
  /** Bắt buộc ở Gate 0: trọng tâm kể Moderator chọn từ menu. */
  narrativeSelection?: NarrativeFocusSelection;
}

/** Payload quyết định của Moderator — khớp `StepDecisionRequestSchema` bên contracts. */
type StepDecision =
  | ({ action: "CONTINUE"; stepType: StepType; baseVersion: number } & ContinueStepOptions)
  | { action: "RERUN"; stepType: StepType; feedback: string }
  | {
      action: "DIRECT_EDIT";
      stepType: StepType;
      baseVersion: number;
      editedOutputJson: unknown;
      note?: string;
    };

async function submitStepDecision(id: number, decision: StepDecision): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/step-decisions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(decision),
  });
  return requestOk(res, `Step decision ${decision.action} ${decision.stepType}`);
}

export async function continueStep(
  id: number,
  stepType: StepType,
  baseVersion: number,
  options: ContinueStepOptions = {}
): Promise<unknown> {
  return submitStepDecision(id, { action: "CONTINUE", stepType, baseVersion, ...options });
}

export async function rerunStep(id: number, stepType: StepType, feedback: string): Promise<unknown> {
  return submitStepDecision(id, { action: "RERUN", stepType, feedback });
}

export async function directEditStep(
  id: number,
  stepType: StepType,
  baseVersion: number,
  editedOutputJson: unknown,
  note?: string
): Promise<unknown> {
  return submitStepDecision(id, { action: "DIRECT_EDIT", stepType, baseVersion, editedOutputJson, note });
}

export async function publishWorkflow(
  id: number,
  approvedVersionId: number,
  approvedBy = "Moderator"
): Promise<number | null> {
  const res = await fetch(`${API_BASE_URL}/workflows/${id}/publications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvedVersionId, approvedBy }),
  });
  const data = await requestOk(res, "Publish workflow");
  if (data && typeof data === "object" && "publicationId" in data) {
    const raw = (data as { publicationId: unknown }).publicationId;
    return typeof raw === "number" ? raw : null;
  }
  return null;
}

export interface WorkflowEventStreamHandlers {
  onEvent: (event: GetWorkflowEventsResponse["events"][number]) => void;
  onDone?: (status: string) => void;
  onError?: (err: Error) => void;
}

/**
 * Why: poll trả cả batch cũ mỗi lần. SSE push row mới qua cursor afterId,
 * EventSource tự reconnect với Last-Event-ID. Trả về hàm đóng stream.
 */
export function subscribeWorkflowEvents(
  id: number,
  handlers: WorkflowEventStreamHandlers,
  afterId = 0
): () => void {
  const url = `${API_BASE_URL}/events/stream?workflowRunId=${id}&afterId=${afterId}`;
  const source = new EventSource(url);
  source.addEventListener("workflow-event", (msg) => {
    try {
      const parsed = JSON.parse((msg as MessageEvent).data as string) as GetWorkflowEventsResponse["events"][number];
      handlers.onEvent(parsed);
    } catch (err) {
      handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  });
  source.addEventListener("workflow-done", (msg) => {
    try {
      const done = JSON.parse((msg as MessageEvent).data as string) as { status: string };
      handlers.onDone?.(done.status);
    } finally {
      source.close();
    }
  });
  source.onerror = () => {
    // EventSource tự retry theo backoff của browser; chỉ báo lỗi, không close.
    handlers.onError?.(new Error("Event stream interrupted, retrying…"));
  };
  return () => source.close();
}
