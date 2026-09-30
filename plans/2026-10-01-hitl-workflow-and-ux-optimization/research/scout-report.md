# Codebase Scout Report: HITL Workflow & UX Optimization

**Mục tiêu**: Rà soát đối chiếu toàn diện hiện trạng mã nguồn monorepo với kế hoạch `plans/2026-10-01-hitl-workflow-and-ux-optimization/` nhằm đảm bảo tính khả thi 100%, không xung đột kiến trúc và loại bỏ mọi giả định sai lầm trước khi triển khai.

---

## 1. Khảo sát phân hệ Contracts (`packages/contracts`)

### Hiện trạng:
- File `packages/contracts/src/workflow/api.ts`:
  - `StepStatusSchema = z.enum(["PENDING", "QUEUED", "RUNNING", "WAITING_FOR_HUMAN", "COMPLETED", "FAILED"])`.
  - `WorkflowStepSchema`: chứa `type`, `status`, `currentVersion`, `approvedVersion`, `errorMessage`, `versions`.
  - Các request schemas hiện tại chỉ có: `CreateWorkflowRequestSchema`, `RegeneratePlannerRequestSchema`, `ApprovePlannerRequestSchema`.
- File `packages/contracts/src/workflow/index.ts`: Re-export toàn bộ schemas của workflow.

### Đánh giá đối chiếu với Plan:
- **Khớp 100%**: Plan yêu cầu bổ sung `STALE` vào `StepStatusSchema` để phục vụ kịch bản invalidation khi rerun upstream.
- **Bổ sung cần thiết**:
  - Tạo `packages/contracts/src/workflow/review-policy.ts`: khai báo `ReviewPolicySchema` (`"AUTO_CONTINUE" | "REVIEW_REQUIRED"`) và hằng số `STEP_REVIEW_POLICY`.
  - Tạo `packages/contracts/src/workflow/actions.ts`: khai báo `RerunStepRequestSchema`, `ContinueStepRequestSchema`, `DirectEditStepRequestSchema`.
  - Mở rộng `WorkflowStepSchema` thêm 2 trường:
    - `reviewPolicy: ReviewPolicySchema`
    - `incomingGuidance: z.string().nullable()`
- **Lưu ý kiểu dữ liệu**: `apps/api/src/workflow/workflow.types.ts` cũng định nghĩa `STEP_STATUSES` tương tự contracts. Phải đồng bộ cả 2 nơi để tránh lệch type.

---

## 2. Khảo sát phân hệ Database & Migrations (`packages/db`)

### Hiện trạng:
- `packages/db/src/schema/workflow-steps.ts`:
  - Các cột hiện tại: `id`, `workflow_run_id`, `step_type`, `status`, `current_version`, `approved_version`, `error_message`, `created_at`, `updated_at`.
- `packages/db/src/schema/step-versions.ts`:
  - Đã có sẵn: `input_json jsonb`, `output_json jsonb`, `human_feedback text`, `validation_status text`.
- Migration history trong `packages/db/drizzle/`:
  - `0000_late_nemesis.sql` (system_events)
  - `0001_even_the_hood.sql` (workflow_runs, workflow_steps, step_versions)
  - `packages/db/drizzle/meta/_journal.json`: đã ghi nhận `idx: 0` và `idx: 1`.
- Migration runner: `packages/db/src/migrate.ts` sử dụng `drizzle-orm/pglite/migrator` trỏ trực tiếp tới folder `packages/db/drizzle`.

### Đánh giá đối chiếu với Plan:
- **Kế hoạch thêm cột `incoming_guidance text` vào `workflow_steps`**: Hoàn toàn khả thi và an toàn.
- **Thực thi Migration**:
  - Tạo file `packages/db/drizzle/0002_add_incoming_guidance.sql`:
    ```sql
    ALTER TABLE "workflow_steps" ADD COLUMN "incoming_guidance" text;
    ```
  - Cập nhật `packages/db/drizzle/meta/_journal.json` thêm `idx: 2`, `tag: "0002_add_incoming_guidance"`.
  - Khi API khởi động ở bước lifecycle [4/9], `runMigrations()` sẽ tự động áp dụng migration này vào PGlite mà không làm mất dữ liệu hiện tại.

---

## 3. Khảo sát phân hệ Queue & Workers (`apps/api/src/queue`)

### Hiện trạng:
- `apps/api/src/workflow/workflow.types.ts`:
  ```ts
  export interface AgentJobPayload {
    workflowRunId: number;
    feedback?: string;
    baseVersion?: number;
  }
  ```
- `apps/api/src/queue/workers.ts`:
  - Hàm `parseAgentPayload()` đã trích xuất sẵn `feedback` và `baseVersion` cho **tất cả** các queues.
- `apps/api/src/queue/jobs/writer.job.ts`:
  - **Điểm nghẽn hiện tại**: Writer đang hardcode version 1 (`version: 1`), hoàn thành xong là tự động gọi `boss.send(WORKFLOW_QUEUES.REVIEWER)`. Không hỗ trợ rerun hay review gate.
- `apps/api/src/queue/jobs/reviewer.job.ts`:
  - **Điểm nghẽn hiện tại**: Reviewer đọc bài viết từ `loadLatestStepOutput(run.id, "WRITER")` thay vì đọc từ bản được duyệt của người dùng.

### Đánh giá đối chiếu với Plan:
- **Khớp hoàn hảo**:
  - `AgentJobPayload` đã có sẵn các trường cần thiết, không cần sửa interface payload của queue.
  - Sửa `writer.job.ts`:
    1. Hỗ trợ cả 2 chế độ: Initial run vs Rerun revision (nhận `payload.feedback` + `payload.baseVersion`).
    2. Đọc `writerStep.incomingGuidance` (lời dặn từ Planner).
    3. Đổi trạng thái kết thúc thành `WAITING_FOR_HUMAN`, lưu version `(step.currentVersion ?? 0) + 1`, **bỏ lệnh tự động enqueue Reviewer**.
  - Sửa `reviewer.job.ts`:
    1. Đọc bài viết đã duyệt qua hàm mới `loadApprovedWriterOutput(run.id)`.
    2. Đọc `reviewerStep.incomingGuidance` (lời dặn từ Writer).
    3. Chạy fact-check $\rightarrow$ Hoàn thành workflow.

---

## 4. Khảo sát phân hệ Agents & Prompts (`apps/api/src/agents`)

### Hiện trạng:
- `apps/api/src/agents/prompts.ts`:
  - Các prompt đã được bọc XML tags: `<product_data>`, `<approved_plan>`, `<human_feedback>`, `<advertisement>`.
  - Planner có cả 2 hàm: `buildPlannerPrompt` và `buildPlannerRegeneratePrompt`.
  - Writer hiện chỉ có 1 hàm duy nhất: `buildWriterPrompt(productDataJson, approvedPlanJson, approvedVersion)`.
  - Reviewer chỉ có 1 hàm: `buildReviewerPrompt(productDataJson, advertisementJson)`.
- `apps/api/src/agents/writer.agent.ts`:
  - Chỉ có `runWriterAgent()`. Chưa có hàm xử lý regenerate khi người dùng yêu cầu sửa bài.
- `apps/api/src/agents/agent-runner.ts`:
  - Chạy session Pi ephemeral, đã tích hợp `zod-to-json-schema` vào system prompt.

### Đánh giá đối chiếu với Plan:
- **Cần bổ sung trong Phase 3**:
  1. Thêm `buildWriterRegeneratePrompt` vào `prompts.ts`:
     - Nhận `productData`, `previousAd`, `humanFeedback`, `approvedPlan`, `approvedVersion`, và `incomingGuidance` (nếu có).
  2. Bổ sung `incomingGuidance` vào `buildWriterPrompt`:
     - Bọc tag `<human_guidance>` để định hướng văn phong/yêu cầu bổ sung của người dùng.
  3. Bổ sung `incomingGuidance` vào `buildReviewerPrompt`:
     - Bọc tag `<focus_areas>` kèm chỉ dẫn: "Đặc biệt chú ý kiểm chứng các dữ kiện được người dùng nhấn mạnh trong focus areas, nhưng vẫn tuân thủ schema đánh giá".
  4. Viết hàm `runWriterRegenerateAgent()` trong `writer.agent.ts`.

---

## 5. Khảo sát phân hệ API Transition & Repository (`apps/api/src/workflow`)

### Hiện trạng:
- `apps/api/src/workflow/workflow.repository.ts`:
  - Các hàm update hiện tại: `updateWorkflowStep(id, patch)` chỉ thực hiện update đơn giản, chưa có điều kiện nguyên tử (atomic WHERE condition).
- `apps/api/src/workflow/workflow.service.ts`:
  - Đã có `loadApprovedPlannerOutput(workflowRunId)`.
  - Cần thêm `loadApprovedWriterOutput(workflowRunId)` cho Reviewer.
- `apps/api/src/routes/workflow.route.ts`:
  - Hiện có `/planner/regenerate` và `/planner/approve`.

### Đánh giá đối chiếu với Plan:
- **Kiến trúc dịch chuyển nguyên tử (Optimistic Locking)**:
  - Viết helper trong repository:
    ```ts
    export async function atomicTransitionStep(
      stepId: number,
      expectedStatus: StepStatus,
      expectedVersion: number,
      patch: { status: StepStatus; approvedVersion?: number | null; incomingGuidance?: string | null }
    ) {
      const rows = await db
        .update(workflowSteps)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(
            eq(workflowSteps.id, stepId),
            eq(workflowSteps.status, expectedStatus),
            eq(workflowSteps.currentVersion, expectedVersion)
          )
        )
        .returning();
      return rows[0] ?? null;
    }
    ```
  - Nếu trả về `null` $\rightarrow$ Endpoint trả ngay `409 Conflict`. Ngăn chặn 100% tình trạng double click hoặc race condition giữa 2 request đồng thời trên PGlite.
- **Tập trung vào `workflow-transition.service.ts`**:
  - Tạo service này như plan Phase 2 để điều phối:
    - Rerun $\rightarrow$ Update step hiện tại về `QUEUED` $\rightarrow$ Enqueue queue hiện tại kèm feedback.
    - Continue $\rightarrow$ Atomic update step hiện tại sang `COMPLETED` $\rightarrow$ Lưu `incomingGuidance` cho step sau $\rightarrow$ Update step sau sang `QUEUED` $\rightarrow$ Enqueue queue bước sau.
    - Invalidate Downstream $\rightarrow$ Nếu rerun một step đã hoàn thành trước đó thì chuyển tất cả downstream steps sang `STALE`.

---

## 6. Khảo sát phân hệ Frontend Web (`apps/web`)

### Hiện trạng:
- `apps/web/lib/workflow-api.ts`:
  - Sử dụng native fetch, validate qua Zod `.safeParse()`.
  - Có cơ chế SSE `subscribeWorkflowEvents` tự động kết nối qua `events.route.ts`.
- `apps/web/app/page.tsx`:
  - Đang dùng bố cục 2 cột cố định: `lg:grid-cols-[400px_1fr]`. Cột trái 400px chứa input và list pipeline tĩnh; cột phải dồn hết TracePanel, HITL Card, Ad Card, Review Card gây chật chội và mất cân đối thị giác.
  - Phím bấm và form duyệt hiện chỉ hỗ trợ riêng cho Planner (`handleRegenerate`, `handleApprove`).
  - Chưa có tính năng chỉnh sửa trực tiếp nội dung (Direct In-Place Edit).
  - Chưa có phím tắt dặn dò nhanh (Quick Action Chips).

### Đánh giá đối chiếu với Plan:
- **Tái cấu trúc Split View (Phase 4)**:
  - Cột trái (60%): Interactive Stepper Container:
    - Hiển thị 4 thẻ `StepCard` (Extractor, Planner, Writer, Reviewer).
    - Mỗi `StepCard` tích hợp Micro-summary bar (Model, duration, version count), tabs chuyển version lịch sử, và Accordion xem log chi tiết.
    - Khi step ở trạng thái `WAITING_FOR_HUMAN`, nhúng trực tiếp `ActionDeck` (chia 2 khối rõ ràng: Rerun Form màu Amber và Continue Form màu Emerald).
  - Cột phải (40%): Sticky Inspector:
    - Tab 1: **Live Ad Preview** (Card trực quan hiển thị bài quảng cáo hoàn chỉnh + Nút 1-click Copy).
    - Tab 2: **Raw JSON Inspector** (Xem dữ liệu thô).
    - Tab 3: **Trace Stream** (Nhúng `TracePanel` có sẵn).
- **Trải nghiệm thao tác (UX Enhancements)**:
  - Tích hợp `QuickActionChips`: Click để tự động điền các câu lệnh phổ biến vào textarea.
  - Tích hợp `DirectInPlaceEdit`: Cho phép người dùng trực tiếp sửa câu từ của Plan hoặc Ad rồi bấm "Save & Continue" ngay lập tức mà không cần gọi lại LLM.

---

## 7. Bảng tổng kết độ tương thích (Compatibility Matrix)

| Hạng mục | Trạng thái hiện tại | Độ khớp kế hoạch | Điều chỉnh / Chú ý đặc biệt |
| :--- | :--- | :--- | :--- |
| **Database Schema** | PGlite singleton, `workflow_steps` |  Khớp 100% | Thêm migration `0002_add_incoming_guidance.sql`, cập nhật journal |
| **Optimistic Lock** | Chưa có, update chay |  Khớp 100% | Dùng `.where(and(eq(status), eq(version))).returning()` chống 409 |
| **Step Policy** | Hardcode planner check |  Khớp 100% | Sử dụng `STEP_REVIEW_POLICY` map tĩnh theo StepType |
| **Writer Review** | Đang auto enqueue Reviewer |  Khớp 100% | Đổi sang dừng chờ `WAITING_FOR_HUMAN`, hỗ trợ Rerun revision |
| **Reviewer Input** | Đang đọc latest draft |  Khớp 100% | Chuyển sang đọc `loadApprovedWriterOutput` |
| **Frontend Layout** | 400px/1fr, dồn card bên phải |  Khớp 100% | Đổi sang 60/40 Split View, Stepper bên trái, Live Preview bên phải |
| **Testing Policy** | "No Tests" trong repo |  Khớp 100% | Xác minh qua `typecheck`, `build` và manual probes |

---

## 8. Kết luận của Scout

Kế hoạch `plans/2026-10-01-hitl-workflow-and-ux-optimization/` **hoàn toàn chính xác, thực tế và khớp 100% với kiến trúc hiện tại của repository**. Không có bất kỳ xung đột tiềm ẩn hay giả định sai lệch nào. Hệ thống sẵn sàng để bắt đầu thực thi **Phase 1** ngay lập tức.
