# Phase 1: Contracts & Database Schema

## Overview
- **Priority**: P1 (Nền tảng)
- **Status**: Pending
- **Estimate**: 1h
- **Mục tiêu**: Xây dựng contract type-safe qua Zod trong `@repo/contracts` và mở rộng schema PostgreSQL trong `@repo/db` phục vụ lưu trữ trạng thái HITL, review policy và incoming guidance.

---

## Key Insights
1. `StepStatus` cần thêm trạng thái `STALE` để phục vụ kịch bản invalidation khi rerun upstream.
2. Tránh tạo bảng `step_transitions` riêng biệt gây thừa thãi dữ liệu và dễ query lệch; lưu `incoming_guidance` trực tiếp vào `workflow_steps` và đóng gói vào `step_versions.input_json`.
3. Mọi dữ liệu chuyển bước (transition event) được ghi nhận vào `system_events` có sẵn (`step.continued`, `step.rerun_requested`).

---

## Requirements

### 1. Functional Requirements
- Bổ sung `ReviewPolicySchema`: `AUTO_CONTINUE` | `REVIEW_REQUIRED`.
- Định nghĩa hằng số `STEP_REVIEW_POLICY`:
  - `EXTRACTOR`: `AUTO_CONTINUE`
  - `PLANNER`: `REVIEW_REQUIRED`
  - `WRITER`: `REVIEW_REQUIRED`
  - `REVIEWER`: `AUTO_CONTINUE`
- Bổ sung các request schemas:
  - `RerunStepRequestSchema`: `{ version: number, feedback: string }`
  - `ContinueStepRequestSchema`: `{ version: number, guidance?: string }`
  - `DirectEditStepRequestSchema`: `{ version: number, outputJson: unknown }`
- Cập nhật `StepStatusSchema`: bổ sung `"STALE"`.
- Cập nhật `WorkflowStepSchema`: bổ sung `reviewPolicy`, `incomingGuidance`.
- Bổ sung cột `incoming_guidance text` vào bảng `workflow_steps`.

### 2. Non-Functional Requirements
- Tuân thủ chuẩn Zod strict validation.
- Migration an toàn, chạy qua `runMigrations()` tự động khi API khởi động, không mất mát dữ liệu cũ trong `packages/db/data/pgdata`.

---

## Architecture & Data Flow

```
packages/contracts/src/workflow/
  ├── review-policy.ts       <-- ReviewPolicySchema & STEP_REVIEW_POLICY
  ├── actions.ts             <-- Rerun, Continue, DirectEdit schemas
  └── api.ts                 <-- StepStatus (thêm STALE), WorkflowStep response

packages/db/src/schema/
  └── workflow-steps.ts      <-- Thêm column incoming_guidance
```

---

## Related Code Files

### Files to Create:
- `packages/contracts/src/workflow/review-policy.ts`
- `packages/contracts/src/workflow/actions.ts`

### Files to Modify:
- `packages/contracts/src/workflow/api.ts`
- `packages/contracts/src/workflow/index.ts`
- `packages/db/src/schema/workflow-steps.ts`
- `packages/db/drizzle/` (Migration script mới)

---

## Implementation Steps

1. **Tạo `packages/contracts/src/workflow/review-policy.ts`**:
   - Khai báo enum `ReviewPolicySchema` và hằng số `STEP_REVIEW_POLICY`.
2. **Tạo `packages/contracts/src/workflow/actions.ts`**:
   - Khai báo Zod schemas cho các thao tác HITL: `RerunStepRequestSchema`, `ContinueStepRequestSchema`, `DirectEditStepRequestSchema`.
3. **Cập nhật `packages/contracts/src/workflow/api.ts`**:
   - Thêm `"STALE"` vào `StepStatusSchema`.
   - Bổ sung `reviewPolicy` và `incomingGuidance` vào `WorkflowStepSchema`.
4. **Cập nhật `packages/contracts/src/workflow/index.ts`**:
   - Export các schemas mới.
5. **Cập nhật `packages/db/src/schema/workflow-steps.ts`**:
   - Thêm `incomingGuidance: text("incoming_guidance")`.
6. **Tạo migration SQL trong `packages/db/drizzle/`**:
   - Tạo file SQL (ví dụ `0002_add_incoming_guidance.sql`) chứa `ALTER TABLE workflow_steps ADD COLUMN incoming_guidance text;`.
   - Cập nhật `packages/db/drizzle/meta/_journal.json`.

---

## Todo List
- [ ] Tạo file `packages/contracts/src/workflow/review-policy.ts`
- [ ] Tạo file `packages/contracts/src/workflow/actions.ts`
- [ ] Cập nhật `StepStatusSchema` & `WorkflowStepSchema` trong `packages/contracts/src/workflow/api.ts`
- [ ] Re-export trong `packages/contracts/src/workflow/index.ts`
- [ ] Thêm column `incomingGuidance` trong `packages/db/src/schema/workflow-steps.ts`
- [ ] Tạo file migration SQL tương thích Drizzle
- [ ] Chạy `bun run typecheck` xác nhận contracts & db hợp lệ

---

## Success Criteria
- `bun run typecheck` chạy qua không có lỗi kiểu dữ liệu.
- DB migration chạy thành công trong lifecycle khởi động của API mà không làm crash PGlite.
