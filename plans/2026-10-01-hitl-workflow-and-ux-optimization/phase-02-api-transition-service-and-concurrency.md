# Phase 2: API Transition Service & Concurrency

## Overview
- **Priority**: P1 (Core Backend Logic)
- **Status**: Pending
- **Estimate**: 1.5h
- **Mục tiêu**: Xây dựng service quản lý chuyển dịch trạng thái tập trung (`workflow-transition.service.ts`) và các API endpoint xử lý Rerun, Continue, Direct Edit với cơ chế Optimistic Locking chống race condition / double-click trên PGlite.

---

## Key Insights
1. **Tránh Deadlock PGlite**: Không bao bọc `boss.send()` vào bên trong Drizzle transaction. Thay vào đó, dùng atomic update SQL:
   ```ts
   UPDATE workflow_steps 
   SET status = 'COMPLETED', approved_version = $v 
   WHERE id = $stepId AND status = 'WAITING_FOR_HUMAN' AND current_version = $v 
   RETURNING id;
   ```
   Nếu trả về 0 row $\rightarrow$ Bắn lỗi `409 Conflict` ngay lập tức. Sau đó mới gọi `boss.send()`.
2. **Tập trung hóa logic**: Routes chỉ nhận request, validate schema Zod, gọi `workflow-transition.service.ts` và trả response.
3. **Invalidation rõ ràng**:
   - Nếu rerun step đang ở `WAITING_FOR_HUMAN`: downstream chưa chạy, không cần làm gì với downstream.
   - Nếu rerun một step đã `COMPLETED` trong quá khứ: kích hoạt `invalidateDownstream()` chuyển tất cả step sau nó sang trạng thái `STALE`.

---

## Requirements

### 1. Functional Requirements
- Triển khai `workflow-order.ts`:
  - Mảng thứ tự step: `["EXTRACTOR", "PLANNER", "WRITER", "REVIEWER"] as const`.
  - Helper lấy step tiếp theo (`getNextStepType(current)`).
  - Helper lấy danh sách downstream steps (`getDownstreamStepTypes(current)`).
- Triển khai `workflow-transition.service.ts`:
  - `rerunStepWithFeedback(workflowId, stepType, version, feedback)`
  - `continueStepWithGuidance(workflowId, stepType, version, guidance?)`
  - `directEditStep(workflowId, stepType, version, outputJson)`
  - `invalidateDownstream(workflowId, fromStepType)`
  - `markStepRunning(workflowId, stepType)`
  - `markStepWaitingForHuman(workflowId, stepType, newVersion)`
  - `markStepFailed(workflowId, stepType, errorMessage)`
- Mở rộng routes trong `apps/api/src/routes/workflow.route.ts`:
  - `POST /workflows/:id/steps/:stepType/rerun`
  - `POST /workflows/:id/steps/:stepType/continue`
  - `POST /workflows/:id/steps/:stepType/edit`
  - Giữ lại tương thích ngược cho endpoint cũ (`/planner/approve`, `/planner/regenerate`) bằng cách ủy quyền sang transition service.
- Cập nhật `GET /workflows/:id` trả về thêm `reviewPolicy` và `incomingGuidance` cho từng step.

### 2. Non-Functional Requirements
- An toàn 100% khi bị double-click (Optimistic Concurrency Control).
- Ghi log sự kiện rõ ràng qua `logEvent()` vào `system_events`.

---

## Architecture & Data Flow

```
HTTP Client (apps/web)
       │ POST /workflows/:id/steps/:stepType/continue
       ▼
workflow.route.ts (validate Zod schema)
       │
       ▼
workflow-transition.service.ts
  ├── 1. Atomic DB Check & Update (status = WAITING_FOR_HUMAN -> COMPLETED)
  ├── 2. Save incomingGuidance to downstream step
  ├── 3. Log event to system_events (SSE timeline)
  └── 4. boss.send(nextQueue, { workflowRunId })
```

---

## Related Code Files

### Files to Create:
- `apps/api/src/workflow/workflow-order.ts`
- `apps/api/src/workflow/workflow-transition.service.ts`

### Files to Modify:
- `apps/api/src/workflow/workflow.repository.ts` (Thêm query atomic update & update incoming guidance)
- `apps/api/src/routes/workflow.route.ts` (Mount các endpoint HITL mới)

---

## Implementation Steps

1. **Tạo `apps/api/src/workflow/workflow-order.ts`**:
   - Khai báo hằng số `STEP_ORDER` và các helper functions điều hướng bước tiếp theo.
2. **Cập nhật `workflow.repository.ts`**:
   - Thêm hàm `atomicTransitionStepStatus(stepId, expectedStatus, expectedVersion, updates)`.
   - Thêm hàm `setDownstreamStepsStale(workflowId, downstreamTypes)`.
3. **Xây dựng `apps/api/src/workflow/workflow-transition.service.ts`**:
   - Viết hàm `continueStepWithGuidance`: kiểm tra policy, kiểm tra version hiện tại, đổi trạng thái sang `COMPLETED`, lưu guidance cho step sau, tạo/update step sau sang `QUEUED`, enqueue job vào pg-boss.
   - Viết hàm `rerunStepWithFeedback`: kiểm tra version hiện tại, đổi trạng thái sang `QUEUED`, enqueue lại queue của step hiện tại kèm feedback.
   - Viết hàm `directEditStep`: tạo version mới với outputJson do user sửa, đánh dấu `humanFeedback: "[User Direct Edit]"`, set approvedVersion = newVersion và gọi continue sang step sau.
4. **Cập nhật `apps/api/src/routes/workflow.route.ts`**:
   - Định nghĩa các route `/steps/:stepType/rerun`, `/steps/:stepType/continue`, `/steps/:stepType/edit`.
   - Bổ sung `reviewPolicy` và `incomingGuidance` vào payload của `GET /workflows/:id`.

---

## Todo List
- [ ] Tạo `apps/api/src/workflow/workflow-order.ts`
- [ ] Bổ sung các atomic repo functions trong `workflow.repository.ts`
- [ ] Viết `apps/api/src/workflow/workflow-transition.service.ts`
- [ ] Đăng ký các route HITL mới trong `apps/api/src/routes/workflow.route.ts`
- [ ] Kiểm tra typecheck toàn bộ workspace: `bun run typecheck`

---

## Success Criteria
- Gửi 2 request Continue đồng thời cho cùng 1 step chỉ 1 request thành công (200), request còn lại nhận `409 Conflict`.
- `GET /workflows/:id` trả về đầy đủ `reviewPolicy` và `incomingGuidance` theo đúng contract.
