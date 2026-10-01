export const WORKFLOW_STATUSES = [
  "PENDING",
  "RUNNING",
  "WAITING_FOR_HUMAN",
  "COMPLETED",
  "FAILED",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const STEP_STATUSES = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "WAITING_FOR_HUMAN",
  "COMPLETED",
  "FAILED",
  "STALE",
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

/** 7 tác tử Flow 2, chạy tuần tự theo STEP_ORDER trong workflow-order.ts. */
export const STEP_TYPES = [
  "RESEARCHER",
  "SOURCE_EVALUATOR",
  "FACT_EXTRACTOR",
  "STORY_PLANNER",
  "SCRIPT_WRITER",
  "ORALIZER",
  "FACT_CHECKER",
] as const;

export type StepType = (typeof STEP_TYPES)[number];

export const DEMO_PING_QUEUE = "demo-ping";

export const WORKFLOW_QUEUES = {
  RESEARCHER: "agent.research-consultation",
  SOURCE_EVALUATOR: "agent.evaluate-sources",
  FACT_EXTRACTOR: "agent.extract-facts",
  STORY_PLANNER: "agent.plan-story",
  SCRIPT_WRITER: "agent.write-script",
  ORALIZER: "agent.oralize-script",
  FACT_CHECKER: "agent.check-facts",
} as const;

export interface NarrativeSelectionPayload {
  selectedFocusType: string;
  seriesTitle: string;
  episodeTitles: [string, string, string];
  editorialNotes?: string;
}

/**
 * Mọi job agent đều mang node cha trên Cây Lịch sử Thực thi, không mang
 * "version number": lineage được dựng bằng cách truy ngược parentVersionId.
 */
export interface AgentJobPayload {
  workflowRunId: number;
  stepType: StepType;
  /** null = node gốc của run (chỉ RESEARCHER). */
  parentVersionId: number | null;
  guidance?: string;
  /** Chỉ Gate 0 (sau RESEARCHER) mới có: trọng tâm kể Moderator đã chọn. */
  narrativeSelection?: NarrativeSelectionPayload;
}

export const MAX_AGENT_RETRY_COUNT = 1;
export const MAX_QUEUE_RETRY_COUNT = 3;
export const MAX_TOPIC_LENGTH = 10000;
export const SHUTDOWN_DRAIN_TIMEOUT_MS = 3000;
export const SHUTDOWN_POLL_INTERVAL_MS = 50;
export const PI_MODEL_REFRESH_TIMEOUT_MS = 1500;
