import { HITL_GATED_STEPS } from "@repo/contracts";
import type { StepType } from "./workflow.types";

export const STEP_ORDER: readonly StepType[] = [
  "RESEARCHER",
  "SOURCE_EVALUATOR",
  "FACT_EXTRACTOR",
  "STORY_PLANNER",
  "SCRIPT_WRITER",
  "ORALIZER",
  "FACT_CHECKER",
] as const;

export function getNextStepType(current: StepType): StepType | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1] ?? null;
}

export function getDownstreamStepTypes(current: StepType): StepType[] {
  const idx = STEP_ORDER.indexOf(current);
  if (idx === -1) return [];
  return STEP_ORDER.slice(idx + 1);
}

export function isHitlGatedStep(stepType: StepType): boolean {
  return (HITL_GATED_STEPS as readonly StepType[]).includes(stepType);
}
