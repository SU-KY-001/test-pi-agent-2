# Phase 6: End-to-End Verification with Golden Case Bạch Đằng 938

## 1. Mục tiêu
Thực hiện kiểm thử tích hợp toàn diện (E2E Integration & Smoke Testing) hệ thống Flow 2 trên toàn bộ chu trình 7 bước, sử dụng case nghiên cứu thực tế chuẩn vàng: **Trận Bạch Đằng năm 938**.
Đảm bảo kết quả kịch bản đầu ra đạt tương đương hoặc vượt trội so với bản mẫu chất lượng cao `outputs/series-bach-dang-938-v2-1.txt`.

## 2. Kịch bản Kiểm thử Từng Bước (Verification Steps)

### Bước 1: Kiểm tra Biên dịch Toàn bộ Codebase (Typecheck & Build)
* Thực thi:
  ```bash
  bun run typecheck
  bun run build
  ```
* **Kỳ vọng:** 0 lỗi TypeScript, 0 cảnh báo schema không tương thích ở cả `@repo/contracts`, `apps/api` và `apps/web`.

### Bước 2: Khởi chạy Cụm Dịch vụ API & Web
* Thực thi:
  ```bash
  bun run dev
  ```
* **Kỳ vọng:**
  * `apps/api` (Hono) khởi động tại port 3001, PGlite nhúng sẵn sàng, pg-boss đăng ký thành công 7 queues (`agent.research-consultation`, `agent.evaluate-sources`, `agent.extract-facts`, `agent.plan-story`, `agent.write-script`, `agent.oralize-script`, `agent.check-facts`).
  * `apps/web` (Next.js 15) khởi động tại port 3000, kết nối SSE tới API ổn định.

### Bước 3: Kiểm thử Khởi tạo & Bước 1 (Researcher) $\rightarrow$ Trạm Kiểm duyệt HITL Gate 0
* Thao tác trên Web UI:
  * Nhập chủ đề: `"Trận Bạch Đằng năm 938"`. Bấm `[Khởi động Quy trình Flow 2]`.
* **Kỳ vọng:**
  * Step 1 hoàn thành trong vòng 15-20 giây, tạo node `v1_researcher (parent: null)`.
  * Hiển thị bảng **Ma trận Nguồn** có ít nhất 4 tầng:
    * *Tier 1:* Đại Việt Sử Ký Toàn Thư, Khâm Định Việt Sử Cương Mục, Tân Ngũ Đại Sử.
    * *Tier 2:* Báo cáo khảo cổ bãi cọc Yên Giang, Cao Quỳ.
    * *Tier 3:* Đặc điểm nhật triều Vịnh Bắc Bộ biên độ 3-4 mét.
    * *Tier 4:* Truyền tích đền thờ Ngô Quyền, tướng Nguyễn Tất Tố.
  * Hiển thị **Menu Trọng tâm kể** với các bộ tiêu đề mẫu cho 3 tập.
  * Workflow dừng lại chính xác tại `WAITING_FOR_HUMAN` (Gate 0).
  * **Thao tác Moderator tại Gate 0:** Click chọn góc *"Cơ chế tự nhiên & Địa lợi"* (hoặc nhập custom) $\rightarrow$ Bấm `[Duyệt & Chạy Thẩm định Nguồn]` $\rightarrow$ Kích hoạt Bước 2 với `parentVersionId: v1_researcher.id`.

### Bước 4: Kiểm thử Bước 2 (Source Evaluator) & Bước 3 (Fact Extractor)
* **Kỳ vọng:**
  * Pipeline tự động chuyển từ Step 2 sang Step 3 dọc theo nhánh đã chọn.
  * Step 3 xuất bản danh sách ít nhất 10 `FactCard` độc lập, có trích đoạn nguồn, niên đại rõ ràng, và chỉ ra ít nhất 1 `identifiedResearchGap` (ví dụ: khoảng trống về lời thoại trực tiếp giữa Ngô Quyền và tướng sĩ).

### Bước 5: Kiểm thử Bước 4 (Story Planner) & Trạm Kiểm duyệt HITL Gate 1 (Kèm Thử nghiệm Rẽ nhánh)
* **Kỳ vọng:**
  * Step 4 sinh Dàn ý 3 tập theo chuỗi **Situation $\rightarrow$ Problem $\rightarrow$ Decision $\rightarrow$ Consequence**.
  * Workflow dừng lại chính xác tại `WAITING_FOR_HUMAN` (Gate 1).
  * **Test Thao tác Người dùng & Rẽ nhánh (Branching):**
    1. Test `Fork from here with Feedback`: Nhập feedback *"Tập trung vào cuộc chạy đua thời gian từ Ái Châu ra Đại La"* $\rightarrow$ Bấm Fork $\rightarrow$ Planner tạo một version mới (nhánh B) cùng trỏ về node cha `v1_facts.id`.
    2. Kiểm tra `execution-tree-view.tsx`: Nhánh A và nhánh B hiển thị song song, nhánh cũ không bị mất hay ghi đè.
    3. Test `Continue with Guidance`: Chọn nhánh B, bấm duyệt $\rightarrow$ Pipeline mở khóa sang Step 5.

### Bước 6: Kiểm thử Bước 5 (Script Writer) & Bước 6 (Oralizer)
* **Kỳ vọng:**
  * Step 5 viết xong bản thảo văn xuôi (độ dài trên 3.000 từ) gắn đúng với nhánh B đã chọn.
  * Step 6 tiếp quản và gọt giũa sang văn nói Text-for-Ear:
    * **Kiểm tra linter tự động:** Không có bất kỳ dấu gạch ngang `-` nào đầu dòng.
    * **Kiểm tra dấu hai chấm:** Không có dấu `:` dùng để liệt kê.
    * **Kiểm tra câu cụt:** Các câu đều có chủ vị đầy đủ, không cụt lủn.
    * **Kiểm tra liên từ:** Xuất hiện tự nhiên các cụm từ nối suy nghĩ ("Thế nhưng", "Điều đáng nói là", "Chính vì thế").

### Bước 7: Kiểm thử Bước 7 (Fact Checker) & Phê duyệt Xuất bản HITL Gate 2
* **Kỳ vọng:**
  * Fact Checker quét sạch sẽ không còn lỗi linter (`oralLinter.hasForbiddenHyphens === false`, `oralLinter.hasForbiddenColons === false`).
  * Toàn bộ các phát biểu trong kịch bản đều được đối chiếu với `FactCards` (trạng thái `VERIFIED` chiếm $\ge 90\%$, không có `CONTRADICTION`).
  * Điểm tổng kết đạt $\ge 85/100$.
  * Workflow dừng lại tại `WAITING_FOR_HUMAN` ở Gate 2.
  * Moderator bấm `[Phê duyệt & Xuất bản Kịch bản]` $\rightarrow$ Tạo bản ghi trong bảng `published_podcasts` với `approvedVersionId`, workflow chuyển `COMPLETED`. Cột trạng thái hiển thị huy hiệu `Đã Xuất Bản`.

### Bước 8: So khớp Chất lượng Đầu ra với Golden Benchmark
* So sánh tệp xuất bản cuối cùng với `outputs/series-bach-dang-938-v2-1.txt`:
  * Độ dài đạt từ 3.000 đến 4.500 từ (~18 - 25 phút nghe podcast).
  * Giữ trọn vẹn văn phong trò chuyện, truyền cảm, có chiều sâu trí tuệ, không biến tướng thành truyện kiếm hiệp hay kịch bản phim dã sử.

## 3. Tiêu chí Nghiệm thu Cuối cùng (Final Acceptance Criteria)
* Toàn bộ quy trình 7 bước chạy thành công End-to-End từ đầu đến cuối trên môi trường Local-First của repo `test-pi-agent-2`.
* Hai tính năng tư vấn biên tập (Ma trận Nguồn & Menu Trọng tâm kể) hoạt động xuất sắc, tạo ấn tượng mạnh mẽ cho bài thuyết trình đồ án WDP301.
