# Phase 4: Agent Runners & pg-boss Queue Workers

## 1. Mục tiêu
Triển khai mã nguồn thực thi cho 7 Agent Runners trong `apps/api/src/agents/` và đăng ký các Worker xử lý hàng đợi tương ứng trong `apps/api/src/queue/`.
Tích hợp một công cụ Linter văn bản thuần mã (Code-based Text-for-Ear Linter) để bắt lỗi cơ học mà không tốn token LLM.

## 2. Danh sách tệp cần tạo mới & cập nhật

| Đường dẫn tệp | Thao tác | Mô tả chi tiết |
| :--- | :--- | :--- |
| `apps/api/src/agents/text-for-ear-linter.ts` | Tạo mới | Utility kiểm tra bằng Regex các lỗi dấu gạch ngang `-`, hai chấm `:`, ngoặc đơn `()` và câu quá ngắn. |
| `apps/api/src/agents/researcher.agent.ts` | Tạo mới | Runner cho Step 1 (Tư vấn nguồn & Menu trọng tâm kể). |
| `apps/api/src/agents/source-evaluator.agent.ts` | Tạo mới | Runner cho Step 2 (Xếp tầng & Kiểm chứng chéo nguồn). |
| `apps/api/src/agents/fact-extractor.agent.ts` | Tạo mới / Sửa | Runner cho Step 3 (Bóc tách Fact Cards & Research Pack). |
| `apps/api/src/agents/story-planner.agent.ts` | Tạo mới / Sửa | Runner cho Step 4 (Lập dàn ý 3 tập theo SPDC). |
| `apps/api/src/agents/script-writer.agent.ts` | Tạo mới / Sửa | Runner cho Step 5 (Viết kịch bản thô 3 tập). |
| `apps/api/src/agents/oralizer.agent.ts` | Tạo mới | Runner cho Step 6 (Chuyển thể văn nói Text-for-Ear). |
| `apps/api/src/agents/fact-checker.agent.ts` | Tạo mới / Sửa | Runner cho Step 7 (Chạy linter regex + LLM claim verification). |
| `apps/api/src/agents/agent-runner.ts` | Cập nhật | Router điều phối trung tâm gọi đúng runner và parse Zod schema. |
| `apps/api/src/queue/workers.ts` | Cập nhật | Đăng ký 7 Queue Handlers với pg-boss. |
| `apps/api/src/queue/jobs/*.ts` | Tạo mới / Sửa | 7 job processors bóc tách payload từ DB, gọi agent runner, ghi version mới và gọi transition service. |

## 3. Chi tiết Kỹ thuật Cốt Lõi

### A. `text-for-ear-linter.ts` (Deterministic Linter)
```typescript
export interface OralLintResult {
  hasForbiddenHyphens: boolean;
  hasForbiddenColons: boolean;
  hasForbiddenParentheses: boolean;
  hasFragmentedSentences: boolean;
  errorDetails: string[];
}

export function lintOralText(text: string): OralLintResult {
  const errorDetails: string[] = [];
  
  // 1. Kiểm tra dấu gạch ngang đầu dòng hoặc giữa câu kiểu liệt kê
  const hyphenMatches = text.match(/(^|\n)\s*[-–—]\s+[^\n]+/g) || text.match(/\s+[-–—]\s+/g);
  if (hyphenMatches && hyphenMatches.length > 0) {
    errorDetails.push(`Phát hiện ${hyphenMatches.length} vị trí dùng dấu gạch ngang liệt kê (cấm trong Text-for-Ear).`);
  }

  // 2. Kiểm tra dấu hai chấm
  const colonMatches = text.match(/[a-zA-Z0-9À-ỹ]:\s+/g);
  if (colonMatches && colonMatches.length > 0) {
    errorDetails.push(`Phát hiện ${colonMatches.length} dấu hai chấm giới thiệu ý (cần thay bằng lời nói tự nhiên).`);
  }

  // 3. Kiểm tra dấu ngoặc đơn
  const parenMatches = text.match(/\([^\)]+\)/g);
  if (parenMatches && parenMatches.length > 0) {
    errorDetails.push(`Phát hiện ${parenMatches.length} đoạn trong ngoặc đơn (phải viết thành lời kể).`);
  }

  // 4. Kiểm tra câu cụt lủn (dưới 4 từ kết thúc bằng dấu chấm mà không có chủ ngữ)
  const sentences = text.split(/(?<=[.?!])\s+/);
  const fragments = sentences.filter(s => {
    const words = s.trim().split(/\s+/);
    return words.length > 0 && words.length <= 3 && !/^(Chào|Cảm ơn|Xin chào|Hết tập)/i.test(s);
  });
  if (fragments.length > 0) {
    errorDetails.push(`Phát hiện ${fragments.length} câu quá ngắn/cụt lủn: ${fragments.slice(0, 3).join("; ")}...`);
  }

  return {
    hasForbiddenHyphens: (hyphenMatches?.length ?? 0) > 0,
    hasForbiddenColons: (colonMatches?.length ?? 0) > 0,
    hasForbiddenParentheses: (parenMatches?.length ?? 0) > 0,
    hasFragmentedSentences: fragments.length > 0,
    errorDetails,
  };
}
```

### B. Tích hợp `pi-web-access` & Agent Runner Router (`agent-runner.ts`)
```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";
import path from "node:path";

// Đường dẫn extension pi-web-access cục bộ đã cài đặt trên hệ thống
const PI_WEB_ACCESS_PATH = path.resolve(
  process.env.USERPROFILE || process.env.HOME || "",
  ".pi/agent/npm/node_modules/pi-web-access"
);

export async function createConfiguredAgentSession(tools: string[] = []) {
  // Khởi tạo session Pi SDK với extension tra cứu web tường minh và allowlist tools
  const session = await createAgentSession({
    extensions: [PI_WEB_ACCESS_PATH],
    toolAllowlist: tools.length > 0 ? tools : ["web_search", "fetch_content"],
  });
  return session;
}
```

### C. Mẫu Job Processor phân nhánh cây (`queue/jobs/oralizer.job.ts`)
```typescript
import type { Job } from "pg-boss";
import type { AgentJobPayload } from "../../workflow/workflow.types";
import { runOralizerAgent } from "../../agents/oralizer.agent";
import { getAncestryLineage } from "../../workflow/workflow-lineage.service";
import { transitionWorkflowStep } from "../../workflow/workflow-transition.service";

export async function processOralizerJob(job: Job<AgentJobPayload>) {
  const { workflowRunId, parentVersionId, guidance } = job.data;
  if (!parentVersionId) throw new Error("parentVersionId is required for branch-aware execution");

  // 1. Truy vết tổ tiên theo nhánh cây để lấy đúng artifact của SCRIPT_WRITER tiền nhiệm
  const { predecessorOutputs } = await getAncestryLineage(parentVersionId);
  const scriptDraft = predecessorOutputs["SCRIPT_WRITER"];
  if (!scriptDraft) {
    throw new Error(`Lineage from ${parentVersionId} does not contain SCRIPT_WRITER output`);
  }

  // 2. Chạy agent oralizer với kịch bản đúng nhánh và guidance
  const oralizedScript = await runOralizerAgent(scriptDraft, guidance);

  // 3. Tạo version con mới trong Cây Lịch sử Thực thi (Adjacency List)
  await transitionWorkflowStep({
    workflowRunId,
    currentStepType: "ORALIZER",
    parentVersionId, // Node cha của lần thực thi này
    outputJson: oralizedScript,
    guidance,
  });
}
```

### D. Đăng ký Handler trong `workers.ts`
```typescript
import { boss } from "./boss";
import { WORKFLOW_QUEUES } from "../workflow/workflow.types";
import { processResearcherJob } from "./jobs/researcher.job";
import { processSourceEvaluatorJob } from "./jobs/source-evaluator.job";
import { processFactExtractorJob } from "./jobs/fact-extractor.job";
import { processStoryPlannerJob } from "./jobs/story-planner.job";
import { processScriptWriterJob } from "./jobs/script-writer.job";
import { processOralizerJob } from "./jobs/oralizer.job";
import { processFactCheckerJob } from "./jobs/fact-checker.job";

export async function registerWorkflowWorkers() {
  await boss.work(WORKFLOW_QUEUES.RESEARCHER, processResearcherJob);
  await boss.work(WORKFLOW_QUEUES.SOURCE_EVALUATOR, processSourceEvaluatorJob);
  await boss.work(WORKFLOW_QUEUES.FACT_EXTRACTOR, processFactExtractorJob);
  await boss.work(WORKFLOW_QUEUES.STORY_PLANNER, processStoryPlannerJob);
  await boss.work(WORKFLOW_QUEUES.SCRIPT_WRITER, processScriptWriterJob);
  await boss.work(WORKFLOW_QUEUES.ORALIZER, processOralizerJob);
  await boss.work(WORKFLOW_QUEUES.FACT_CHECKER, processFactCheckerJob);
}
```

## 4. Tiêu chí Hoàn thành
* Cả 7 job workers được đăng ký thành công vào pg-boss instance khi khởi động API server.
* Hàm `lintOralText` bắt chính xác 100% các câu có lỗi vi phạm văn bản.
