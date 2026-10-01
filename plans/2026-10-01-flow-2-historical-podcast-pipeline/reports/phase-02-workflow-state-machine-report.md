# Phase 2 Report — Execution Tree DB, State Machine & Queues

## Trạng thái: HOÀN TẤT
`bun --cwd packages/db typecheck` + `bun --cwd apps/api typecheck` sạch.

## Tầng dữ liệu
| Tệp | Thay đổi |
| :--- | :--- |
| `packages/db/drizzle/0003_flow2_execution_tree.sql` | Thêm `step_versions.parent_version_id` (self-FK, adjacency list) + bảng `published_podcasts` |
| `packages/db/src/schema/step-versions.ts` | `parentVersionId`, `humanFeedback`, ràng buộc FK về chính nó |
| `packages/db/src/schema/published-podcasts.ts` | Bản ghi xuất bản bất biến (`approvedVersionId`, `finalScript`, `wordCount`, `estimatedDurationSeconds`, `publishedAt`) |
| `packages/db/src/schema/workflow-runs.ts` | `currentStep` theo 7 bước mới, `completedAt` |
| `packages/db/src/schema/index.ts` | Export schema mới |

`workflow_step.current_version` trỏ vào node mới nhất, `approved_version` là node Moderator đã ký. Node là append-only: sửa/rerun đều sinh node mới.

## Nghiệp vụ
| Tệp | Nội dung |
| :--- | :--- |
| `apps/api/src/workflow/workflow.types.ts` | `STEP_TYPES` 7 bước, `WORKFLOW_QUEUES` 7 queue (`agent.research-consultation`, `agent.evaluate-sources`, `agent.extract-facts`, `agent.plan-story`, `agent.write-script`, `agent.oralize-script`, `agent.check-facts`), `AgentJobPayload { workflowRunId, stepType, parentVersionId, guidance?, narrativeSelection? }` |
| `apps/api/src/workflow/workflow-order.ts` | `STEP_ORDER`, `getNextStepType`, `getDownstreamStepTypes`, `isHitlGatedStep` |
| `apps/api/src/workflow/workflow-lineage.service.ts` | `getAncestryLineage(parentVersionId)` truy ngược `parent_version_id` → `{ ancestors, predecessorOutputs }`; `getNodeWithType(id)` |
| `apps/api/src/workflow/workflow.service.ts` | `loadPredecessorOutput` (ném lỗi nếu nhánh thiếu ngữ cảnh), `loadLineage`, `findAncestorNode`, `saveStepNode` (append node + trỏ `current_version`), `loadNodeByStepVersion` |
| `apps/api/src/workflow/workflow-transition.service.ts` | `continueStepWithGuidance` (optimistic lock `atomicTransitionStepStatus` → enqueue bước kế với `parentVersionId` = node vừa duyệt; ở FACT_CHECKER thì publish + COMPLETED), `rerunStepWithFeedback` (fork: node mới là anh em với node hiện tại, `setDownstreamStepsStale`), `directEditStep` (chỉ khi WAITING_FOR_HUMAN, validate schema) |
| `apps/api/src/workflow/publication.service.ts` | `publishFromApprovedNode` idempotent theo `approvedVersionId`, ghép 3 tập văn nói thành `finalScript` |
| `apps/api/src/queue/boss.ts` | Tạo 5 → 7 queue từ `STEP_TYPES` |
| `apps/api/src/routes/workflow.route.ts` | `POST /workflows`, `GET /workflows/:id`, `GET /workflows/:id/tree`, `POST /:id/steps/:type/{continue,rerun,direct-edit}`, `POST /:id/publish` |

## Quyết định quan trọng
- **Bất biến thay vì cập nhật**: không có UPDATE trên `step_versions`; mọi thay đổi (rerun, direct-edit) là node mới ⇒ lịch sử nhánh luôn xem lại được.
- **Fork giữ nhánh cũ**: `rerunStepWithFeedback` đặt `parentVersionId` = parent của node hiện tại (anh em ruột), nên nhánh đã duyệt không bị ghi đè. Bước hạ nguồn bị đánh `STALE`.
- **Ngữ cảnh theo nhánh**: `GET /workflows/:id` trả đủ 7 bước theo `STEP_ORDER` kể cả bước chưa chạy, để dashboard luôn vẽ được toàn pipeline.
- **Gate 2 = publish**: duyệt node FACT_CHECKER chính là hành động xuất bản (`continueStepWithGuidance` gọi `publishFromApprovedNode`), nên không có endpoint publish riêng bắt buộc; `POST /:id/publish` chỉ để publish lại node cũ.

## Sai lệch so với plan
- Plan đặt `findAncestorNode` trong `workflow-lineage.service.ts`; thực tế đặt trong `workflow.service.ts` (tránh import vòng giữa lineage ⇄ service). Đã sửa import của `publication.service.ts` tương ứng.
