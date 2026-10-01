# Phase 4 Report — Agent Runners & pg-boss Queue Workers

## Trạng thái: HOÀN TẤT
`bun --cwd apps/api typecheck` sạch sau khi sửa import của `publication.service.ts`.

## Tệp thay đổi
| Tệp | Thay đổi |
| :--- | :--- |
| `apps/api/src/agents/agent-runner.ts` | Nạp extension `pi-web-access` qua `additionalExtensionPaths` (giữ `noExtensions: true`), allowlist cứng 4 tool web (`web_search`, `fetch_content`, `get_search_content`, `source_check`); 6 bước còn lại `tools: []` + `noTools: "all"`. Thêm `AgentRunOptions.toolPolicy` |
| `apps/api/src/config/env.ts` | `PI_WEB_ACCESS_DIR` (optional, mặc định `C:/Users/ADMIN/.pi/agent/npm/node_modules/pi-web-access`) |
| `.env.example` | Ghi chú biến mới |
| `apps/api/src/agents/workflow-agent.ts` | `runWorkflowStepAgent(stepType, ctx, { workflowRunId })` — một cửa cho cả 7 tác tử |
| `apps/api/src/queue/jobs/agent-step.job.ts` | Một job cho cả 7 bước: load run/step → RUNNING + log event → dựng ngữ cảnh theo lineage → chạy agent → `saveStepNode` → tự chạy tiếp hoặc dừng ở trạm HITL |
| `apps/api/src/queue/workers.ts` | Vòng lặp `STEP_TYPES` đăng ký 7 worker trên 7 queue; payload guard chặt (`workflowRunId` number, `stepType` khớp queue, `parentVersionId` number/null, `narrativeSelection` hợp lệ) |
| `apps/api/src/queue/jobs/{extractor,planner,reviewer,writer}.job.ts` | **Xoá** |
| `apps/api/src/agents/{extractor,planner,reviewer,writer}.agent.ts` | **Xoá** |
| `apps/api/src/agents/prompts.ts` | Rút gọn còn `buildSchemaRetryPrompt` |

## Cơ chế cốt lõi
1. Job không mang "version number", chỉ mang `parentVersionId`; lineage dựng lại ngữ cảnh của đúng nhánh đó (`loadLineage`).
2. Sau khi lưu node: nếu bước là trạm HITL ⇒ `step=WAITING_FOR_HUMAN` + `run=WAITING_FOR_HUMAN` và dừng; nếu `AUTO_CONTINUE` ⇒ `step=COMPLETED` rồi enqueue bước kế với `parentVersionId` = node vừa tạo, kèm `narrativeSelection` để giữ trọng tâm kể đã chọn ở Gate 0.
3. **ORALIZER có vòng tự sửa tất định**: linter bắt lỗi ⇒ chạy lại đúng một lần (`MAX_AGENT_RETRY_COUNT = 1`) với chính danh sách lỗi làm guidance; vẫn lỗi ⇒ `FAILED` kèm `errorMessage` chi tiết. Không im lặng xuất bản văn nói hỏng.
4. Phân loại lỗi giống Flow 1: `AgentValidationError` và lỗi thiếu ngữ cảnh ⇒ `FAILED` terminal, không rethrow; lỗi khác ⇒ `FAILED` rồi rethrow để pg-boss retry (tối đa 3).
5. `node.inputJson` chỉ lưu con trỏ ngữ cảnh (`parentVersionId`, `guidance`, `narrativeSelection`, danh sách bước tiền nhiệm), KHÔNG sao chép output của tổ tiên — tránh phình DB gấp nhiều lần.

## Sai lệch so với plan
- **Gộp file (có chủ đích)**: plan yêu cầu 7 file job + 7 file agent; thực tế 1 job (`agent-step.job.ts`) + 1 runner (`workflow-agent.ts`). Khác biệt giữa các bước chỉ còn schema (đã ở mapper), trạm HITL (tra từ contracts) và linter của ORALIZER, nên 14 file gần giống nhau là bản sao chờ lệch nhau. Thêm tác tử mới = thêm một case `buildStepPrompt` + một entry `STEP_OUTPUT_SCHEMAS`.
- ~~Chưa có vòng tự sửa FACT_CHECKER → SCRIPT_WRITER~~ — **đính chính**: plan KHÔNG yêu cầu vòng này. `phase-02-workflow-state-machine-and-queues.md:164` ghi rõ `FACT_CHECKER → 🛑 HITL GATE 2 (Phê duyệt Xuất bản)`, tức dừng cho người nghe thử. Muốn sửa thì Moderator fork `SCRIPT_WRITER` kèm feedback (luồng `rerun` đã có). Dòng cũ ở đây là yêu cầu do tôi tự nghĩ ra, không phải sai lệch so với plan.

## Điểm chưa kiểm chứng được
- Chưa chạy RESEARCHER thật (cần API key provider) nên **chưa xác nhận pi-web-access nạp được tool trong runtime**; đây là rủi ro số 1 của phase này và là bước đầu tiên của Phase 6.
- Nếu `PI_WEB_ACCESS_DIR` không tồn tại, extension không nạp và RESEARCHER sẽ chạy không có tool (LLM trả JSON thiếu nguồn ⇒ fail ở schema). Cần smoke test `POST /pi/test` + một workflow thật.
