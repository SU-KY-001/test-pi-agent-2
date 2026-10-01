/** Rollup dùng khi FEEDBACK/DIRECT_EDIT không cần chạy agent (plan §9.C2/C4). */

export interface DecisionRollup {
  decision: "ADVANCED";
  reason: string;
}

export interface RevisionRollup {
  decision: "REVISED";
  revisedVersionId: number;
  revisedVersion: number;
}

export function asDecisionRollup(reason: string): DecisionRollup {
  return { decision: "ADVANCED", reason };
}

export function asRevisionRollup(revisedVersionId: number, revisedVersion: number): RevisionRollup {
  return { decision: "REVISED", revisedVersionId, revisedVersion };
}
