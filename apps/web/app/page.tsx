"use client";

import { useEffect, useRef, useState } from "react";
import type { GetWorkflowResponse } from "@repo/contracts";
import {
  approvePlanner,
  createWorkflow,
  fetchWorkflow,
  regeneratePlanner,
} from "../lib/workflow-api";

const DEFAULT_INPUT = `Bình giữ nhiệt 750ml.
Giữ lạnh 18 giờ, giữ nóng 10 giờ.
Vỏ inox.
Giá 299.000đ.
Đối tượng là sinh viên và dân văn phòng.`;

type StepView = GetWorkflowResponse["steps"][number];

function stepByType(steps: StepView[], type: string): StepView | undefined {
  return steps.find((s) => s.type === type);
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function HomePage() {
  const [rawInput, setRawInput] = useState<string>(DEFAULT_INPUT);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (workflowId == null) return;
    const poll = async () => {
      try {
        setWorkflow(await fetchWorkflow(workflowId));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), 1000);
    return () => {
      clearInterval(pollRef.current);
    };
  }, [workflowId]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await createWorkflow(rawInput);
      setWorkflowId(res.id);
      setWorkflow(null);
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleRegenerate = async () => {
    if (workflowId == null || !feedback.trim()) return;
    setActing(true);
    setError(null);
    try {
      await regeneratePlanner(workflowId, feedback.trim());
      setFeedback("");
      setWorkflow(await fetchWorkflow(workflowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async () => {
    if (workflowId == null || !workflow) return;
    const planner = stepByType(workflow.steps, "PLANNER");
    if (!planner?.currentVersion) return;
    setActing(true);
    setError(null);
    try {
      await approvePlanner(workflowId, planner.currentVersion);
      setWorkflow(await fetchWorkflow(workflowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const planner = workflow ? stepByType(workflow.steps, "PLANNER") : undefined;
  const writer = workflow ? stepByType(workflow.steps, "WRITER") : undefined;
  const reviewer = workflow ? stepByType(workflow.steps, "REVIEWER") : undefined;
  const extractor = workflow ? stepByType(workflow.steps, "EXTRACTOR") : undefined;
  const plannerCurrent = planner?.versions.find((v) => v.version === planner.currentVersion);
  const writerCurrent = writer?.versions.find((v) => v.version === writer.currentVersion);
  const reviewerCurrent = reviewer?.versions.find((v) => v.version === reviewer.currentVersion);
  const reviewOutput = (reviewerCurrent?.outputJson ?? null) as {
    passed?: boolean;
    issues?: { claim: string; reason: string; expectedFact: string | null }[];
  } | null;
  const adOutput = (writerCurrent?.outputJson ?? null) as {
    headline?: string;
    body?: string;
    callToAction?: string;
  } | null;

  return (
    <div className="container">
      <h1>Ad Workflow Demo</h1>

      <section>
        <h2>1. Product input</h2>
        <textarea
          rows={6}
          cols={70}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
        />
        <br />
        <button onClick={handleStart} disabled={starting || !rawInput.trim()}>
          {starting ? "Starting..." : "Start Workflow"}
        </button>
        {workflowId != null && <p>Workflow #{workflowId}</p>}
      </section>

      {error && (
        <section>
          <h2>Error</h2>
          <pre>{error}</pre>
        </section>
      )}

      {workflow && (
        <>
          <section>
            <h2>2. Pipeline state ({workflow.status})</h2>
            <ul>
              <li>Extractor — {extractor?.status ?? "PENDING"}</li>
              <li>
                Planner — {planner?.status ?? "PENDING"}
                {planner?.currentVersion != null && ` (v${planner.currentVersion})`}
                {planner?.approvedVersion != null && ` approved v${planner.approvedVersion}`}
              </li>
              <li>Writer — {writer?.status ?? "PENDING"}</li>
              <li>Reviewer — {reviewer?.status ?? "PENDING"}</li>
            </ul>
          </section>

          {workflow.status === "WAITING_FOR_HUMAN" && plannerCurrent && (
            <section>
              <h2>3. Planner review (v{planner?.currentVersion})</h2>
              <pre>{formatJson(plannerCurrent.outputJson)}</pre>
              {planner && planner.versions.length > 1 && (
                <p>
                  Versions: {planner.versions.map((v) => `v${v.version}`).join(", ")} (current v
                  {planner.currentVersion})
                </p>
              )}
              <textarea
                rows={3}
                cols={70}
                placeholder="Feedback, e.g. Tập trung hoàn toàn vào sinh viên..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <br />
              <button onClick={handleRegenerate} disabled={acting || !feedback.trim()}>
                Regenerate
              </button>{" "}
              <button onClick={handleApprove} disabled={acting}>
                Approve & Continue
              </button>
            </section>
          )}

          {workflow.status === "COMPLETED" && (
            <section>
              <h2>4. Result</h2>
              <p>
                Extractor ✓ Planner ✓ v{planner?.approvedVersion} approved Writer ✓ Reviewer ✓
              </p>
              {adOutput && (
                <>
                  <h3>Advertisement</h3>
                  <p><strong>{adOutput.headline}</strong></p>
                  <p>{adOutput.body}</p>
                  <p>CTA: {adOutput.callToAction}</p>
                </>
              )}
              {reviewOutput && (
                <>
                  <h3>Review — {reviewOutput.passed ? "PASS" : "FAILED FACT CHECK"}</h3>
                  {!reviewOutput.passed && (
                    <ul>
                      {(reviewOutput.issues ?? []).map((issue, i) => (
                        <li key={i}>
                          {issue.claim} — {issue.reason}
                          {issue.expectedFact ? ` (expected: ${issue.expectedFact})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
          )}

          {workflow.status === "FAILED" && (
            <section>
              <h2>Workflow failed</h2>
              <pre>{formatJson(workflow.steps)}</pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
