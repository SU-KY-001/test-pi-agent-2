# Phase 5: Frontend Editorial Dashboard & Dual-Gate UI

## 1. Mục tiêu
Nâng cấp giao diện Web trong `apps/web/` thành một **Editorial Co-Pilot Dashboard** chuyên nghiệp dành cho Moderator Podcast Lịch sử:
* Hiển thị bảng điều khiển 7 bước với trạng thái thời gian thực qua SSE (`TracePanel`).
* Component trực quan hóa **Ma trận Nguồn phân tầng & Kiểm chứng chéo** (`source-matrix-card.tsx`).
* Component lựa chọn tương tác **Menu 5 Trọng tâm kể kèm Tiêu đề mẫu** (`narrative-menu-card.tsx`).
* Trình xem trước kịch bản 3 tập (`live-podcast-preview.tsx`) hiển thị số từ, thời lượng ước tính và trạng thái sẵn sàng cho máy đọc TTS.
* Action Deck với Quick Action Chips hỗ trợ biên tập lịch sử thần tốc.

## 2. Danh sách tệp cần tạo mới & cập nhật

| Đường dẫn tệp | Thao tác | Mô tả chi tiết |
| :--- | :--- | :--- |
| `apps/web/app/page.tsx` | Cập nhật | Cấu hình 7 `STEP_DEFINITIONS`, input ban đầu cho chủ đề lịch sử, tabs điều khiển. |
| `apps/web/components/execution-tree-view.tsx` | Tạo mới | Cây trực quan hóa các node lịch sử thực thi, cho phép xem lại node cũ và bấm Fork/Rerun từ bất kỳ node nào. |
| `apps/web/components/source-matrix-card.tsx` | Tạo mới | Hiển thị danh mục nguồn theo Tier 1-4, điểm tin cậy và ghi chú kiểm chứng chéo. |
| `apps/web/components/narrative-menu-card.tsx` | Tạo mới | Hiển thị các thẻ trọng tâm kể kèm tiêu đề mẫu, hỗ trợ chọn hoặc nhập custom tại Gate 0. |
| `apps/web/components/live-podcast-preview.tsx` | Tạo mới / Thay thế | Trình đọc kịch bản 3 tập trực quan, phân đoạn mở đầu - cao trào - kết thúc, đếm từ, nút Xuất bản. |
| `apps/web/components/step-card.tsx` | Cập nhật | Tích hợp các bộ renderer chuyên biệt cho Fact Cards, SPDC Outline, Oralized Script. |
| `apps/web/components/action-deck.tsx` | Cập nhật | Bổ sung Quick Chips chuyên dụng cho biên kịch lịch sử và nút Fork/Rerun từ node được chọn. |

## 3. Chi tiết Giao diện & Component

### A. Cập nhật `STEP_DEFINITIONS` trong `page.tsx`
```typescript
const STEP_DEFINITIONS: { type: StepType; label: string; description: string }[] = [
  { type: "RESEARCHER", label: "1. Tư vấn biên tập", description: "Lập ma trận nguồn uy tín & đề xuất menu 5 trọng tâm kể" },
  { type: "SOURCE_EVALUATOR", label: "2. Thẩm định nguồn", description: "Xếp tầng nguồn Tier 1-4 & kiểm chứng chéo tư liệu" },
  { type: "FACT_EXTRACTOR", label: "3. Bóc tách Fact Pack", description: "Tạo Fact Cards độc lập, niên đại & khoảng trống sử liệu" },
  { type: "STORY_PLANNER", label: "4. Lập dàn ý 3 tập", description: "Áp mô hình Situation-Problem-Decision-Consequence (SPDC)" },
  { type: "SCRIPT_WRITER", label: "5. Soạn thảo kịch bản", description: "Viết văn bản tự sự chi tiết 3.000 - 4.500 từ theo tư liệu" },
  { type: "ORALIZER", label: "6. Chuyển thể Text-for-Ear", description: "Khử câu cụt, cấm dấu '-' và ':', chêm liên từ tự nhiên cho TTS" },
  { type: "FACT_CHECKER", label: "7. Kiểm định sự thật", description: "Linter ký tự cấm & đối chiếu claim với Fact Cards" },
];
```

### B. `execution-tree-view.tsx` (Cây Lịch sử Thực thi & Phân nhánh)
* Trực quan hóa cấu trúc cây Adjacency List:
  * Hiển thị các nhánh đã chạy: Node gốc (Step 1) $\rightarrow$ Các node con (Step 2 $\rightarrow$ ... $\rightarrow$ Step 7).
  * Mỗi node hiển thị badge trạng thái (`WAITING_FOR_HUMAN`, `COMPLETED`), thời gian chạy và version ID.
  * Khi click vào một node cũ:
    - Chế độ **Xem lại (Read-only replay)**: Hiển thị artifact của node đó mà không kích hoạt gọi AI.
    - Nút **"Fork / Rerun from here"**: Mở form nhập feedback/guidance để tạo nhánh mới từ node đó, tiếp tục chạy các bước tiếp theo trên nhánh mới mà không làm mất nhánh cũ.

### C. `source-matrix-card.tsx` (Ma trận Nguồn)
* Hiển thị Badge màu sắc cho từng tầng:
  * `Tier 1: Chính sử` (Xanh dương đậm - ĐVSKTT, Khâm định, Tân Ngũ Đại Sử).
  * `Tier 2: Khảo cổ học` (Xanh lá cây - Bãi cọc Yên Giang, Cao Quỳ).
  * `Tier 3: Khoa học tự nhiên` (Tím - Thủy triều Vịnh Bắc Bộ).
  * `Tier 4: Dã sử & Thần phả` (Vàng cam - Truyền thuyết, đền miếu).
* Hiển thị bảng so sánh chéo: Nguồn nào bổ sung cho nguồn nào, chi tiết nào còn nghi vấn.

### D. `narrative-menu-card.tsx` (Menu Trọng tâm kể tại Gate 0)
* Hiển thị các Card trực quan tương ứng với các góc tiếp cận do AI đề xuất:
  1. *Diễn biến chiến trận* (Tiêu đề mẫu: "Cái bẫy sụp đổ của hạm đội Nam Hán").
  2. *Nguyên nhân & Bối cảnh* (Tiêu đề mẫu: "Từ nhát dao Đại La đến chiến trường Bạch Đằng").
  3. *Nhân vật & Tâm lý* (Tiêu đề mẫu: "Ngô Quyền: Bản lĩnh chấm dứt một ngàn năm Bắc thuộc").
  4. *Cơ chế tự nhiên* (Tiêu đề mẫu: "Khi thủy triều trở thành vũ khí giết giặc").
  5. *Ý nghĩa thời đại* (Tiêu đề mẫu: "Bước ngoặt 938: Bình minh của một quốc gia tự chủ").
* Ô nhập tuỳ biến: Cho phép Moderator tự gõ góc kể riêng hoặc chỉnh sửa tiêu đề 3 tập.
* Nút `[Chấp thuận & Tiếp tục]`: Kích hoạt mở khóa Gate 0 để chạy sang Step 2.

### E. `live-podcast-preview.tsx` (Trình duyệt Kịch bản Podcast & Phê duyệt Xuất bản)
* Tab chuyển đổi giữa **Tập 1**, **Tập 2**, **Tập 3** và **Toàn bộ Series**.
* Header hiển thị:
  * Tổng số từ (ví dụ: `4.120 từ`).
  * Thời lượng ước tính khi đọc bằng TTS (ví dụ: `~22 phút`).
  * Trạng thái Text-for-Ear: `100% Valid (Không câu cụt, 0 dấu gạch ngang)`.
* Tại Gate 2 (sau Fact Checker): Nút `[Phê duyệt & Xuất bản Kịch bản]` hiển thị nổi bật. Khi bấm, gọi API lưu bản ghi vào `published_podcasts` với `approvedVersionId` cụ thể và ghim badge `PUBLISHED`.

### E. Quick Action Chips cho Lịch sử (`action-deck.tsx`)
* *"Nhấn mạnh cơ chế bãi cọc 45 độ và biên độ thủy triều 3-4m"*
* *"Làm rõ sự cô lập và động cơ phản trắc của Kiều Công Tiễn"*
* *"Tập trung vào cuộc chạy đua thời gian từ Ái Châu ra Đại La"*
* *"Làm mềm câu văn, chêm thêm liên từ nối chuyển ý"*
* *"Cắt bỏ các chi tiết suy đoán cảm xúc nội tâm nhân vật"*

## 4. Tiêu chí Hoàn thành
* Giao diện hiển thị mượt mà trên trình duyệt, không giật lag khi chuyển step.
* Thao tác click chọn Menu trọng tâm kể hoạt động trơn tru.
* Lệnh `bun run --filter apps/web build` thành công 100%.
