# Nhật Ký Kỹ Thuật (Engineering Journal) - Cài Đặt Flow 2: Pipeline Podcast Lịch Sử

**Ngày:** 02/10/2026  
**Tác giả:** AI Assistant  
**Chủ đề:** Tái cấu trúc pipeline quảng cáo thành pipeline sản xuất nội dung âm thanh lịch sử có tương tác nhân sự và cây phiên bản.

---

## 1. Bối Cảnh & Mục Tiêu
Yêu cầu chuyển đổi hệ thống từ pipeline quảng cáo 4 bước đơn giản sang Flow 2: Pipeline sản xuất Podcast Lịch Sử gồm 7 bước chuyên sâu, có 3 cổng duyệt nhân sự (HITL Gate 0: Ngữ liệu, Gate 1: Dàn ý & Góc nhìn, Gate 2: Kịch bản & Xuất bản), hỗ trợ cây thực thi (Execution Tree: Fork/Rerun, Direct Edit, Khóa lạc quan chống xung đột phiên bản), tích hợp Oral Linter (Text-for-Ear) và xuất bản đa định dạng.

## 2. Các Quyết Định Kỹ Thuật Trọng Tâm
1. **Thiết kế Cây Phiên Bản (Execution Tree):**
   - Thay vì lưu đè phiên bản cũ, bảng `step_versions` được thiết kế có `parent_version_id`, `version_number`, và `is_selected`.
   - Khi Rerun một bước, một phiên bản mới được tạo ra làm nhánh con, các bước phụ thuộc phía sau bị hạ thành `STALE`, bảo toàn toàn bộ lịch sử tư liệu đã thử nghiệm.
2. **Quy chuẩn API Hợp Nhất (Single Decision Route):**
   - Hợp nhất các thao tác tác động vào bước (tiếp tục, chạy lại, chỉnh sửa trực tiếp) thành một endpoint duy nhất: `POST /workflows/:id/step-decisions`.
   - Request body được xác thực chặt chẽ qua Zod Discriminated Union, loại bỏ hoàn toàn các lỗi định tuyến dư thừa.
3. **Bộ Kiểm Âm Phát Thanh (Oral Linter):**
   - Không áp dụng mù quáng các thuật toán chấm văn bản viết thông thường. Oral Linter được tối ưu hóa cho tai nghe (Text-for-Ear):
     - Bắt câu quá dài (> 35 từ gây hụt hơi).
     - Bắt câu cụt (<= 3 từ), nhưng miễn trừ các câu chào/cảm ơn mở và kết chương trình.
     - Phát hiện lặp từ cận kề và các cụm từ khó phát âm.
4. **Trải Nghiệm Biên Tập Trên Trình Duyệt:**
   - Bổ sung khả năng đồng bộ URL `?runId=X` để người dùng có thể tải lại trang hoặc chia sẻ liên kết trực tiếp tới bất kỳ phiên bản nào đang xử lý.
   - Giao diện được kiểm thử tương tác thực tế bằng `agent-browser`.

## 3. Bài Học & Lưu Ý
- **Cơ sở dữ liệu PGlite:** Khi sao lưu hoặc di chuyển thư mục dữ liệu PGlite bị lỗi checkpoint, tuyệt đối không đặt bản sao trong thư mục dự án vì `.gitignore` mặc định chỉ bỏ qua đường dẫn chính xác `packages/db/data/pgdata/`. Việc tạo thư mục có tên tiền tố tương tự sẽ làm lọt hàng nghìn file nhị phân vào Git tracking. Giải pháp tốt nhất là di chuyển ra ngoài thư mục repo (`~/...`).
- **Khóa lạc quan:** Luôn truyền `baseVersion` khi thực hiện `DIRECT_EDIT` để bảo đảm tính toàn vẹn dữ liệu khi có nhiều biên tập viên cùng thao tác.
