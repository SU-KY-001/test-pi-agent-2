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
] as const;

export type StepStatus = (typeof STEP_STATUSES)[number];

export const STEP_TYPES = [
  "EXTRACTOR",
  "PLANNER",
  "WRITER",
  "REVIEWER",
] as const;

export type StepType = (typeof STEP_TYPES)[number];

export const DEMO_PING_QUEUE = "demo-ping";

export const WORKFLOW_QUEUES = {
  EXTRACTOR: "agent.extract-product",
  PLANNER: "agent.plan-content",
  WRITER: "agent.write-ad",
  REVIEWER: "agent.review-ad",
} as const;

export interface AgentJobPayload {
  workflowRunId: number;
  /** Planner regeneration mode carries feedback + base version */
  feedback?: string;
  baseVersion?: number;
}

export const MAX_AGENT_RETRY_COUNT = 1;
export const MAX_QUEUE_RETRY_COUNT = 3;
export const MAX_RAW_PRODUCT_TEXT_LENGTH = 10000;
export const SHUTDOWN_DRAIN_TIMEOUT_MS = 3000;
export const SHUTDOWN_POLL_INTERVAL_MS = 50;
export const PI_MODEL_REFRESH_TIMEOUT_MS = 1500;
