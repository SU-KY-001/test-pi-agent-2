---
title: "HITL Workflow & UX Optimization Implementation Plan"
description: "Nâng cấp kiến trúc Human-in-the-Loop (HITL) 2 chặng (Planner + Writer) với cơ chế Rerun Feedback, Forward Guidance, Optimistic Locking trên PGlite và tối ưu trải nghiệm người dùng với Interactive Stepper & Live Preview."
status: completed
priority: P1
effort: 6h
branch: main
tags: [backend, frontend, hitl, ux, database, queue, agent]
blockedBy: []
blocks: []
created: 2026-10-01
---

# HITL Workflow & UX Optimization Implementation Plan

## Overview

Kế hoạch này nâng cấp hệ thống workflow hiện tại từ cơ chế duyệt đơn điểm (Planner Approve/Regenerate cứng) thành một kiến trúc Human-in-the-Loop (HITL) 2 chặng chuẩn công nghiệp (Planner & Writer đều có Review Gate), đồng thời cách mạng hóa giao diện điều khiển (UX) giúp người dùng vừa dễ dàng theo dõi nhịp thở của Agent, vừa có thể can thiệp nhanh chóng để chốt sản phẩm cuối.

Hệ thống tuân thủ nghiêm ngặt các ràng buộc:
- **Zero-external-daemon**: Giữ nguyên kiến trúc chạy nhúng PGlite + pg-boss.
- **Single Runtime Owner**: Chỉ `apps/api` truy cập DB và Queue; `apps/web` giao tiếp thuần HTTP/SSE.
- **Không thư viện test tự động**: Tuân thủ chính sách "No Tests" của repo; kiểm chứng bằng `typecheck`, `build` và endpoint/UI verification.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| None | N/A | N/A |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Contracts & Database Schema](./phase-01-contracts-and-db-schema.md) | Completed |
| 2 | [API Transition Service & Concurrency](./phase-02-api-transition-service-and-concurrency.md) | Completed |
| 3 | [Agent Runner & Queue Workers](./phase-03-agent-runner-and-queue-workers.md) | Completed |
| 4 | [Frontend Interactive Stepper & Live Preview](./phase-04-frontend-interactive-stepper-and-preview.md) | Completed |
| 5 | [Verification & Manual Probes](./phase-05-verification-and-smoke-testing.md) | Completed |

## Key Technical Decisions

1. **Pragmatic State Storage (KISS & DRY)**:
   - Lưu `incomingGuidance` trực tiếp vào `workflow_steps` và truyền vào `step_versions.inputJson`.
   - Sử dụng bảng `system_events` có sẵn để audit lịch sử chuyển bước và truyền phát SSE, không đẻ thêm bảng `step_transitions` gây rủi ro lệch query khi rerun.
2. **Optimistic Locking trên PGlite**:
   - Sử dụng atomic SQL `UPDATE ... WHERE status = 'WAITING_FOR_HUMAN' AND current_version = $v RETURNING id` để ngăn chặn triệt để race condition / double-click mà không gây deadlock kết nối WASM PGlite.
3. **Phân định rõ Rerun vs Guidance**:
   - `Rerun with Feedback`: Sửa lại chính step hiện tại (feedback đưa vào prompt Revision).
   - `Continue with Guidance`: Duyệt version hiện tại, chuyển sang downstream kèm chỉ dẫn bổ sung.
4. **UX 3 Tầng Điều Khiển**:
   - Agent sửa tự động (Rerun) + Người dùng sửa trực tiếp (Quick In-Place Edit) + Duyệt & Dặn dò (Continue with Guidance).
   - Tách biệt 2 form thao tác riêng biệt, kèm Quick Action Chips giúp chốt kết quả nhanh gấp 5 lần.

## Reference Materials
- [Scout Research Report](./research/scout-report.md) (Báo cáo rà soát đối chiếu toàn diện hiện trạng codebase)
- [Raw Implementation Plan](./reports/raw-report.md) (Ý tưởng sơ khởi ban đầu từ `@HITL_IMPLEMENTATION_PLAN.md`)

