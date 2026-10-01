# Phase 5 Report — Frontend Editorial Dashboard (Moderator Cockpit)

## Trạng thái: HOÀN TẤT — đã kiểm chứng bằng agent-browser trên dữ liệu thật
- `bun --cwd apps/web typecheck` → `TYPECHECK_EXIT=0`
- `bun --cwd apps/web build` → `BUILD_EXIT=0` (`○ /` 46.1 kB, First Load 149 kB)
- Grep chốt: `grep -rnE "\b(EXTRACTOR|PLANNER|WRITER|REVIEWER)\b|ContentPlan|Advertisement" apps/web --exclude-dir=.next` → **exit 1, không match** (Flow 1 đã sạch)
- Snapshot `http://localhost:3000` bằng `agent-browser`: render đủ "TIẾN TRÌNH THỰC THI 7 BƯỚC" + 4 tab (Kịch bản 3 tập / Cây thực thi / Nhật ký Trace / JSON), copy tiếng Việt, không còn lỗi `500`.

## Tệp thay đổi
| Tệp | Trạng thái |
| :--- | :--- |
| `apps/web/app/page.tsx` | viết lại — `STEP_DEFINITIONS` 7 bước, form tạo, poll 2s, nội dung 3 trạm gate, panel phải |
| `apps/web/components/step-card.tsx` | viết lại — chip status, người ký duyệt, guidance, error, dải tab version, renderer output read-only |
| `apps/web/components/narrative-menu-card.tsx` | mới — Gate 0: ma trận nguồn + 5 lựa chọn trọng tâm kể + sửa tiêu đề/ghi chú |
| `apps/web/components/source-matrix-card.tsx` | mới — ma trận nguồn đã thẩm định: tier, điểm tin cậy, kiểm chứng chéo |
| `apps/web/components/live-podcast-preview.tsx` | mới — preview 3 tập từ `OralizedScript` + `formatDuration`/`formatWordCount` |
| `apps/web/components/trace-panel.tsx` | sửa 1 hunk — `classify()` suy ra agentName từ `step.<type>.*` |
| `apps/web/app/layout.tsx` | sửa metadata → podcast 7 bước |
| `apps/web/components/live-ad-preview.tsx` | **xoá** (tàn dư Flow 1) |
| `components/action-deck.tsx`, `execution-tree-view.tsx`, `lib/workflow-api.ts`, `lib/step-status.ts` | đã đúng Flow 2 từ trước, chỉ xác minh chữ ký prop |

Dọn thêm: xoá `apps/web/.turbo/turbo-typecheck.log` và `apps/web/.next/cache` (còn chuỗi Flow 1 từ build lỗi trước).

## Quyết định UI quan trọng
1. **Thứ tự chọn version để hiển thị**: tab người dùng bấm → `currentVersion` → `approvedVersion`. Lý do: `rerunStepWithFeedback` (`apps/api/src/workflow/workflow-transition.service.ts:145-200`) fork từ `parentVersionId` và **không xoá** `approvedVersion`, nên ưu tiên approved sẽ giấu mất nhánh vừa fork.
2. **Gate 0 chỉ có đúng một đường duyệt** là `NarrativeMenuCard` (radio + sửa tên series/tập + ghi chú → `continue` kèm `narrativeSelection`); `StepCard` của RESEARCHER không nhận `onContinue` để không thể duyệt mà quên chọn trọng tâm kể.
3. **Gate 2** đọc danh sách publications từ `GET /tree` (không đọc `publicationId` của response continue) và dựng kịch bản cuối bằng cách đi ngược `parentVersionId` từ node FACT_CHECKER hiện hành lên node ORALIZER.
4. Direct-edit chỉ mở cho 3 bước HITL khi `WAITING_FOR_HUMAN`; validate `JSON.parse` phía client; `409 baseVersion` hiển thị lỗi từ API.
5. Không thêm dependency; dùng `Intl.NumberFormat("vi-VN")` và `SOURCE_TIER_LABELS` từ contracts; mọi payload parse qua Zod trước khi render.

## Chi phí đã biết (ghi lại để không quên)
`GET /workflows/:id/tree` bị gọi lại mỗi nhịp poll 2s vì panel Gate 2 cần cây tổ tiên. Trên localhost không sao; gọi API từ xa thì nên cache theo `currentVersion`.

## Việc chưa nối
`publishWorkflow` (POST `/workflows/:id/publish`) typecheck được nhưng chưa gắn vào nút nào — theo đặc tả, xuất bản xảy ra qua `continue` ở Gate 2. Muốn có nút "xuất bản lại" thì nối thêm.
