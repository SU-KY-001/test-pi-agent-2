# Phase 6 Report — E2E Verification, Golden Case Bạch Đằng 938

## Kết luận: E2E CHẠY HẾT 7 BƯỚC + XUẤT BẢN THÀNH CÔNG (workflow #100)

| Bước | Node id | Trạng thái | Bằng chứng |
| :--- | ---: | :--- | :--- |
| 1 RESEARCHER | 133 | COMPLETED (approved v1) | 148 lần `web_search` thật; ma trận nguồn + menu 5 trọng tâm kể |
| 2 SOURCE_EVALUATOR | 134 | COMPLETED | parent 133 |
| 3 FACT_EXTRACTOR | 135 | COMPLETED | parent 134 |
| 4 STORY_PLANNER | 136 | COMPLETED (duyệt Gate 1) | parent 135 |
| 5 SCRIPT_WRITER | — | COMPLETED | parent 136 |
| 6 ORALIZER | — | COMPLETED | parent kế tiếp |
| 7 FACT_CHECKER | 139 | COMPLETED (duyệt Gate 2 ⇒ xuất bản) | parent node 6 |

Chuỗi `parent_version_id` liền mạch 133 → 134 → 135 → 136 → … → 139, không gãy nhánh. `GET /workflows/100/tree` trả **7 node, đúng 1 node mỗi bước** (chưa fork) và `publications: [{ id: 1, approvedVersionId: 139 }]`.

## Số liệu đầu ra cuối cùng
- `status`: **COMPLETED**, `currentStep`: null, `publicationId`: **1**
- Tổng độ dài: **4.492 từ** (1.466 + 1.494 + 1.532) — nằm trong khoảng 3.000–4.500 từ của đặc tả
- Thời lượng ước tính: **31 phút**
- 3 tập văn nói:
  1. *Kiểu Công Tiễn, Dương Đình Nghệ và chức Tiết độ sứ, sự kiện năm 937 mở đường cho chiến tranh, diễn biến qua đối chiếu sử Việt và sử Trung Quốc* (1.466 từ)
  2. *Nước triều lên rồi rút, diễn biến trận Bạch Đằng tháng Chạp năm 938, dựng lại từng bước từ chính sử và mô hình thủy triều* (1.494 từ)
  3. *Sau khi Hoằng Tháo tử trận, Lưu Cung rút quân và khoảng trống quyền lực ở Tĩnh Hải quân, diễn biến hậu chiến 938 đến 939* (1.532 từ)
- **Linter Text-for-Ear (server-side, xác nhận lại độc lập trên `outputJson`)**: `hasForbiddenColons=false`, `hasForbiddenHyphens=false`, `hasForbiddenParentheses=false`, `hasFragmentedSentences=false`, `errorDetails=[]` → **SẠCH**, khớp kiểm tra regex độc lập của tao: `CLEAN`.
- **Review report**: `passed: true`, `overallScore: **88**`, `claimVerification`: **50 mục**, dạng `{ status: VERIFIED, explanation, scriptSentence, matchedFactCardId }` — mỗi câu trong kịch bản được gắn về fact card gốc (ví dụ `FC-01`, `FC-02`).
- `moderatorSummaryFeedback`: xác nhận tầng sự kiện cấp cao (FC-01/02/03) kể đúng, các tầng `DEBATED`/`INSUFFICIENT` (FC-05/06/11/14/17/20/21/13) **đều được nêu như tranh luận, không chốt thành sự thật**, chi tiết khảo cổ (FC-09/10) đúng định tuổi, **không có lời thoại riêng tư bịa đặt**, không có chi tiết sau 1945.

## Kiểm chứng hạ tầng
- `GET /health` → `{"status":"ok","services":{"api":true,"database":true,"queue":true,"pi":true}}`
- 7 queue pg-boss đăng ký đúng tên theo `STEP_TYPES`
- `bun --cwd apps/web typecheck` → 0; `bun --cwd apps/web build` → 0; `GET localhost:3000` render đủ 7 bước (snapshot `agent-browser`), hết lỗi `500`
- **Xác nhận `pi-web-access` nạp được tool trong runtime thật** — đây là rủi ro số 1 đã ghi ở báo cáo Phase 4; RESEARCHER đã gọi web search thành công nên coi như RỦI RO ĐÃ ĐÓNG.

## Việc CHƯA làm / chưa kiểm chứng
1. **Chưa so với bản mẫu vàng**: `plans/.../outputs/series-bach-dang-938-v2-1.txt` (đặc tả Phase 6 gọi tên) **không tồn tại trong repo** — `find` toàn repo không thấy file nào tên `*bach-dang*` ngoài chính phase-06. Tiêu chí "đạt tương đương hoặc vượt bản mẫu" chưa thể kết luận; cần bổ sung file mẫu.
2. **Chưa test rẽ nhánh (fork) trên run thật**: run 100 đi thẳng 1 node/bước. Luồng `rerun` (fork sibling + `STALE` hạ nguồn) mới chỉ kiểm tra qua code, chưa thao tác trên UI.
3. **Chưa test `direct-edit` và `409 baseVersion`** trên UI.
4. **UI chưa từng hiển thị run có id cụ thể**: dashboard chỉ tạo run mới, không có cách mở lại run cũ (không đọc `?runId=`) ⇒ mỗi lần refresh là mất ngữ cảnh. Đây là thiếu sót thật của Phase 5, không phải lỗi E2E.
5. `GET /workflows/:id/tree` bị gọi lại mỗi nhịp poll 2s.

## Ghi chú vận hành
Toàn bộ run 100 mất khoảng **~20 phút wall-clock**, trong đó gần như toàn bộ là thời gian LLM của 7 phiên agent (bước RESEARCHER tự thân ~5–8 phút vì 148 lần tìm kiếm web), không phải thời gian build/render. Đây là chi phí cố hữu của "research thật", không phải nút thắt có thể sửa bằng code.
