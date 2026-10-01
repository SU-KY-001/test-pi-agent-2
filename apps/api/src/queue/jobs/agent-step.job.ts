import { isHitlGatedStep } from "@repo/contracts";
import { AgentValidationError } from "../../agents/agent-runner";
import { runWorkflowStepAgent } from "../../agents/workflow-agent";
import { log } from "../../config/logger";
import { boss } from "../boss";
import { lintOralText, type OralLintResult } from "../../workflow/oral-linter";
import { getNextStepType } from "../../workflow/workflow-order";
import {
  ensureWorkflowStep,
  getStepVersion,
  getWorkflowRun,
  logEvent,
  updateWorkflowRun,
  updateWorkflowStep,
} from "../../workflow/workflow.repository";
import { loadLineage, saveStepNode } from "../../workflow/workflow.service";
import {
  MAX_AGENT_RETRY_COUNT,
  MAX_QUEUE_RETRY_COUNT,
  WORKFLOW_QUEUES,
  type AgentJobPayload,
  type StepType,
} from "../../workflow/workflow.types";

/**
 * Một job duy nhất chạy cả 7 bước Flow 2.
 *
 * Khác biệt giữa các bước chỉ còn: output schema (đã nằm trong prompt mapper),
 * trạm HITL (contracts.isHitlGatedStep) và linter văn nói của ORALIZER.
 * Không nhân bản 7 file gần giống nhau.
 */
export async function handleAgentStepJob(payload: AgentJobPayload): Promise<void> {
  const { workflowRunId, stepType, parentVersionId } = payload;
  const jobLog = log.child({ scope: "agent-job", workflowRunId, step: stepType });

  const run = await getWorkflowRun(workflowRunId);
  if (!run) throw new Error(`Workflow ${workflowRunId} not found`);

  const step = await ensureWorkflowStep(workflowRunId, stepType);
  await updateWorkflowStep(step.id, {
    status: "RUNNING",
    errorMessage: null,
    incomingGuidance: payload.guidance ?? null,
  });
  await updateWorkflowRun(workflowRunId, { status: "RUNNING", currentStep: stepType });
  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.started`,
    message: `${stepType} started (parent=${parentVersionId ?? "root"})`,
    metadataJson: { stepType, parentVersionId, guidance: payload.guidance ?? null },
  });

  try {
    const lineage = await loadLineage(parentVersionId);

    // Fork/rerun: node trước của chính bước này là ngữ cảnh để sửa, không phải tổ tiên.
    const ownPrevious =
      payload.guidance && step.currentVersion != null
        ? await getStepVersion(step.id, step.currentVersion)
        : null;

    const ctx = {
      topic: run.topic,
      predecessorOutputs: lineage.predecessorOutputs,
      ownPreviousOutput: ownPrevious?.outputJson,
      incomingGuidance: payload.guidance ?? null,
      selectedFocusType: payload.narrativeSelection?.selectedFocusType ?? null,
      narrativeSelection: payload.narrativeSelection ?? null,
      userProvidedSources: null,
    };

    if (stepType === "ORALIZER") {
      const { output, lint } = await produceOralizedScript(ctx, workflowRunId, jobLog);
      const { node } = await saveStepNode({
        workflowRunId,
        stepType,
        parentVersionId,
        input: nodeInput(payload, lineage.predecessorOutputs),
        output,
        humanFeedback: payload.guidance ?? null,
      });
      await logEvent({
        workflowRunId,
        type: "step.oralizer.lint_passed",
        message: `ORALIZER v${node.version} vượt qua linter văn nói (${lint.sentences} câu, ${lint.words} từ)`,
        metadataJson: { nodeId: node.id, stepType, lint: { sentences: lint.sentences, words: lint.words } },
      });
      await advanceOrGate({ payload, nodeId: node.id, stepId: step.id, stepType });
      return;
    }

    const output = await runWorkflowStepAgent(stepType, ctx, { workflowRunId });
    const { node } = await saveStepNode({
      workflowRunId,
      stepType,
      parentVersionId,
      input: nodeInput(payload, lineage.predecessorOutputs),
      output,
      humanFeedback: payload.guidance ?? null,
    });
    jobLog.info({ nodeId: node.id, version: node.version }, "Agent step saved");
    await advanceOrGate({ payload, nodeId: node.id, stepId: step.id, stepType });
  } catch (err) {
    await failStep({ workflowRunId, stepId: step.id, stepType, err, jobLog });
  }
}

function nodeInput(
  payload: AgentJobPayload,
  predecessorOutputs: Partial<Record<StepType, unknown>>
): Record<string, unknown> {
  // Node chỉ lưu con trỏ ngữ cảnh, không sao chép lại output của tổ tiên:
  // lineage truy ngược parentVersionId đã dựng lại được toàn bộ.
  return {
    parentVersionId: payload.parentVersionId,
    guidance: payload.guidance ?? null,
    narrativeSelection: payload.narrativeSelection ?? null,
    predecessorSteps: Object.keys(predecessorOutputs),
  };
}

/**
 * Sau khi lưu node: dừng ở trạm HITL chờ Moderator, hoặc tự chạy tiếp bước kế.
 * Bước kế nhận `parentVersionId` = node vừa tạo nên nhánh được giữ nguyên.
 */
async function advanceOrGate(params: {
  payload: AgentJobPayload;
  nodeId: number;
  stepId: number;
  stepType: StepType;
}): Promise<void> {
  const { payload, nodeId, stepId, stepType } = params;
  const { workflowRunId } = payload;

  if (isHitlGatedStep(stepType)) {
    await updateWorkflowStep(stepId, { status: "WAITING_FOR_HUMAN" });
    await updateWorkflowRun(workflowRunId, { status: "WAITING_FOR_HUMAN", currentStep: stepType });
    await logEvent({
      workflowRunId,
      type: `step.${stepType.toLowerCase()}.waiting_for_human`,
      message: `${stepType} chờ Moderator duyệt (node ${nodeId})`,
      metadataJson: { stepType, nodeId },
    });
    return;
  }

  const nextStepType = getNextStepType(stepType);
  await updateWorkflowStep(stepId, { status: "COMPLETED" });

  if (!nextStepType) {
    await updateWorkflowRun(workflowRunId, { status: "COMPLETED", currentStep: null, completedAt: new Date() });
    return;
  }

  await ensureWorkflowStep(workflowRunId, nextStepType, "QUEUED");
  await updateWorkflowRun(workflowRunId, { status: "RUNNING", currentStep: nextStepType });
  await boss.send(
    WORKFLOW_QUEUES[nextStepType],
    {
      workflowRunId,
      stepType: nextStepType,
      parentVersionId: nodeId,
      narrativeSelection: payload.narrativeSelection,
    } satisfies AgentJobPayload,
    { retryLimit: MAX_QUEUE_RETRY_COUNT, retryBackoff: true }
  );
  await logEvent({
    workflowRunId,
    type: `step.${nextStepType.toLowerCase()}.queued`,
    message: `${nextStepType} auto-queued from ${stepType} node ${nodeId}`,
    metadataJson: { from: stepType, nodeId, nextStepType },
  });
}

function lintEpisodes(script: { episodes: readonly { episodeNumber: number; spokenNarration: string }[] }): OralLintResult {
  const results = script.episodes.map((episode) => ({
    episodeNumber: episode.episodeNumber,
    result: lintOralText(episode.spokenNarration),
  }));

  const errorDetails = results.flatMap(({ episodeNumber, result }) =>
    result.errorDetails.map((detail) => `Tập ${episodeNumber}: ${detail}`)
  );

  return {
    passed: errorDetails.length === 0,
    hasForbiddenHyphens: results.some((r) => r.result.hasForbiddenHyphens),
    hasForbiddenColons: results.some((r) => r.result.hasForbiddenColons),
    hasForbiddenParentheses: results.some((r) => r.result.hasForbiddenParentheses),
    hasFragmentedSentences: results.some((r) => r.result.hasFragmentedSentences),
    errorDetails,
    detailErrors: results.flatMap((r) => r.result.detailErrors),
    sentences: results.reduce((sum, r) => sum + r.result.sentences, 0),
    words: results.reduce((sum, r) => sum + r.result.words, 0),
  };
}

/**
 * ORALIZER có vòng tự sửa tất định: linter bắt lỗi dấu câu/câu cụt thì chạy lại
 * đúng một lần với chính lỗi đó làm guidance. Vẫn lỗi ⇒ FAILED (fail-fast), không
 * im lặng xuất bản văn nói hỏng.
 */
async function produceOralizedScript(
  ctx: Parameters<typeof runWorkflowStepAgent<"ORALIZER">>[1],
  workflowRunId: number,
  jobLog: { info: (obj: unknown, msg: string) => void; warn: (obj: unknown, msg: string) => void }
) {
  let guidance = ctx.incomingGuidance ?? null;

  for (let attempt = 0; attempt <= MAX_AGENT_RETRY_COUNT; attempt += 1) {
    const output = await runWorkflowStepAgent(
      "ORALIZER",
      { ...ctx, incomingGuidance: guidance },
      { workflowRunId }
    );
    const lint = lintEpisodes(output);
    if (lint.passed) return { output, lint };

    if (attempt === MAX_AGENT_RETRY_COUNT) {
      throw new AgentValidationError(
        `Văn nói vẫn lỗi sau ${attempt + 1} lần chạy: ${lint.errorDetails.join(" ")}`,
        JSON.stringify(lint.detailErrors)
      );
    }

    jobLog.warn({ attempt, errors: lint.errorDetails }, "Oral linter failed, regenerating once");
    await logEvent({
      workflowRunId,
      type: "step.oralizer.lint_failed",
      message: `Linter văn nói bắt lỗi, chạy lại ORALIZER: ${lint.errorDetails.join(" ")}`,
      metadataJson: { attempt, errorDetails: lint.errorDetails },
    });
    guidance = [ctx.incomingGuidance, `Lỗi văn nói bắt buộc sửa: ${lint.errorDetails.join(" ")}`]
      .filter((part): part is string => !!part && part.length > 0)
      .join("\n\n");
  }

  throw new Error("produceOralizedScript: unreachable");
}

async function failStep(params: {
  workflowRunId: number;
  stepId: number;
  stepType: StepType;
  err: unknown;
  jobLog: { error: (obj: unknown, msg: string) => void };
}): Promise<void> {
  const { workflowRunId, stepId, stepType, err, jobLog } = params;
  const message = err instanceof Error ? err.message : String(err);
  jobLog.error({ err }, `${stepType} job failed`);

  await updateWorkflowStep(stepId, { status: "FAILED", errorMessage: message });
  await updateWorkflowRun(workflowRunId, { status: "FAILED", currentStep: stepType });
  await logEvent({
    workflowRunId,
    type: `step.${stepType.toLowerCase()}.failed`,
    message,
  });

  // Lỗi schema/validate và thiếu ngữ cảnh là lỗi nội dung — retry pg-boss vô ích.
  if (err instanceof AgentValidationError) return;
  if (/lineage thiếu|not found|xuất bản|không tồn tại/i.test(message)) return;
  throw err;
}
