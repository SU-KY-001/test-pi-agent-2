# Phase 3: Agent Runner & Queue Workers

## Overview
- **Priority**: P1 (Agent Execution Pipeline)
- **Status**: Pending
- **Estimate**: 1.5h
- **Mục tiêu**: Chuẩn hóa input contract cho các Agent, nâng cấp `writer.job.ts` có Review Gate (`WAITING_FOR_HUMAN`), hỗ trợ Rerun Revision cho Writer, và truyền Guidance an toàn (có guardrail) từ Planner sang Writer và từ Writer sang Reviewer.

---

## Key Insights
1. **Writer HITL Gate**: Hiện tại Writer tự động enqueue Reviewer ngay khi viết xong. Phải đổi thành: Writer viết xong $\rightarrow$ lưu version mới $\rightarrow$ đặt trạng thái `WAITING_FOR_HUMAN`. Chỉ khi user bấm Continue tại Writer thì Reviewer mới được enqueue!
2. **Writer Rerun Support**: Writer cần có nhánh Revision tương tự Planner: nhận `previousAdvertisement` + `humanFeedback` để viết lại mà vẫn bám sát dữ kiện sản phẩm gốc.
3. **Reviewer Guidance Guardrail**: Reviewer là một fact-checker nghiêm ngặt theo Zod schema. Lời dặn truyền sang Reviewer (ví dụ: "Kiểm tra kỹ thông số giữ nhiệt") chỉ được đóng vai trò **Focus Area (Trọng tâm soi dữ kiện)**, không được phép làm sai lệch định dạng schema.

---

## Requirements

### 1. Functional Requirements
- **`apps/api/src/agents/prompts.ts` & `writer.agent.ts`**:
  - Hỗ trợ tham số `incomingGuidance` trong prompt soạn bài viết.
  - Thêm prompt revision cho Writer khi user gửi feedback:
    ```text
    Previous advertisement:
    ...
    Human feedback:
    ...
    Revise your previous output based on feedback while maintaining factual accuracy.
    ```
- **`apps/api/src/agents/reviewer.agent.ts`**:
  - Bổ sung tham số `incomingGuidance` vào prompt fact-check.
  - Thêm guardrail: "Focus extra attention on the human guidance criteria while strictly enforcing factual consistency against the product data."
- **`apps/api/src/queue/jobs/planner.job.ts`**:
  - Đọc `incomingGuidance` từ step Extractor (nếu có).
  - Kết thúc job: chuyển step và workflow sang `WAITING_FOR_HUMAN`.
- **`apps/api/src/queue/jobs/writer.job.ts`**:
  - Tách 2 nhánh: Initial Run vs Rerun with Feedback.
  - Đọc `approvedPlannerOutput` (Plan đã được user duyệt) + `incomingGuidance` từ Planner.
  - Kết thúc job: lưu version mới, chuyển step và workflow sang `WAITING_FOR_HUMAN` (KHÔNG tự ý enqueue Reviewer).
- **`apps/api/src/queue/jobs/reviewer.job.ts`**:
  - Đọc bài viết quảng cáo từ version đã được user approve của Writer.
  - Đọc `incomingGuidance` từ Writer.
  - Chạy fact-check $\rightarrow$ lưu version Reviewer $\rightarrow$ chuyển step sang `COMPLETED` $\rightarrow$ chuyển workflow sang `COMPLETED`.

### 2. Non-Functional Requirements
- Đảm bảo an toàn Pi SDK: Ephemeral sessions, dispose session trong `finally`, không gọi bash/fs tool.
- Giữ đúng Zod parse validation qua `runStructuredAgent()`.

---

## Architecture & Data Flow

```
[PLANNER COMPLETED (Approved v2)]
       │
       │ Guidance: "Viết tối giản, tránh emoji"
       ▼
[WRITER JOB]
  ├── Input: ProductData + Approved Plan v2 + Incoming Guidance (+ Feedback nếu rerun)
  ├── Output: Advertisement
  └── State: WAITING_FOR_HUMAN (Dừng chờ người dùng duyệt bài)

       │
[USER APPROVE WRITER v2]
       │
       │ Guidance: "Soi kỹ thông số 18h và vỏ inox"
       ▼
[REVIEWER JOB]
  ├── Input: ProductData + Approved Advertisement v2 + Incoming Guidance
  ├── Output: ReviewResult { passed, issues }
  └── State: COMPLETED -> Workflow COMPLETED
```

---

## Related Code Files

### Files to Modify:
- `apps/api/src/agents/prompts.ts`
- `apps/api/src/agents/writer.agent.ts`
- `apps/api/src/agents/reviewer.agent.ts`
- `apps/api/src/queue/jobs/writer.job.ts`
- `apps/api/src/queue/jobs/reviewer.job.ts`
- `apps/api/src/workflow/workflow.service.ts` (Thêm hàm `loadApprovedWriterOutput`)

---

## Implementation Steps

1. **Cập nhật `workflow.service.ts`**:
   - Thêm `loadApprovedWriterOutput(workflowRunId)`: kiểm tra Writer đã có `approvedVersion` chưa, nếu chưa có thì throw error (ngăn Reviewer chạy lậu khi Writer chưa được duyệt).
2. **Cập nhật `apps/api/src/agents/prompts.ts`**:
   - Thêm `buildWriterPrompt(productData, plan, incomingGuidance?)`.
   - Thêm `buildWriterRegeneratePrompt(productData, previousAd, feedback, incomingGuidance?)`.
   - Thêm `buildReviewerPrompt(productData, advertisement, incomingGuidance?)`.
3. **Cập nhật `apps/api/src/agents/writer.agent.ts`**:
   - Bổ sung hàm `runWriterRegenerateAgent(...)`.
4. **Cập nhật `apps/api/src/agents/reviewer.agent.ts`**:
   - Truyền `incomingGuidance` vào prompt kiểm chứng.
5. **Tái cấu trúc `apps/api/src/queue/jobs/writer.job.ts`**:
   - Xử lý payload rerun vs initial run.
   - Bỏ đoạn tự động enqueue `boss.send(REVIEWER)` sau khi Writer xong; đổi trạng thái thành `WAITING_FOR_HUMAN`.
6. **Cập nhật `apps/api/src/queue/jobs/reviewer.job.ts`**:
   - Gọi `loadApprovedWriterOutput(run.id)` để lấy đúng bản thảo đã được user duyệt.

---

## Todo List
- [ ] Bổ sung hàm `loadApprovedWriterOutput` trong `workflow.service.ts`
- [ ] Cập nhật prompt templates trong `prompts.ts` hỗ trợ guidance & feedback cho Writer/Reviewer
- [ ] Viết hàm `runWriterRegenerateAgent` trong `writer.agent.ts`
- [ ] Cập nhật `writer.job.ts` sang cơ chế `WAITING_FOR_HUMAN`
- [ ] Cập nhật `reviewer.job.ts` nhận approved output và guidance
- [ ] Kiểm tra typecheck toàn bộ workspace: `bun run typecheck`

---

## Success Criteria
- Writer chạy xong không tự động nhảy sang Reviewer mà dừng ở trạng thái `WAITING_FOR_HUMAN`.
- Gọi rerun Writer tạo ra version mới v2; gọi continue Writer mới kích hoạt Reviewer với đúng guidance.
