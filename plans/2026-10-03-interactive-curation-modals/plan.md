---
title: "Interactive Output Curation Modals Implementation Plan"
description: "Xây dựng giao diện Modal chỉnh sửa trực quan (thêm, sửa, xóa) cho output của các Agent ở các trạm dừng (HITL Gate), chuyển dịch tư duy từ 'prompt AI chạy lại' sang 'AI làm trợ lý, người dùng trực tiếp chỉnh sửa dữ liệu'."
status: completed
priority: P1
effort: 4h
branch: main
tags: [frontend, hitl, ux, workflow, curation]
blockedBy: []
blocks: []
created: 2026-10-03
---

# Kế Hoạch Triển Khai: Chỉnh Sửa Trực Quan Output Của Agent (Interactive Curation Modals)

## 1. Tổng Quan

Chuyển đổi cách tương tác với hệ thống AI Agent từ phụ thuộc 100% vào prompt ("hễ sai là phải prompt lại để sinh mới") sang mô hình **AI là trợ lý nháp - Con người trực tiếp chỉnh sửa và quyết định (Human Curates & Decides)**:
- AI Agent tạo ra bản thảo đầu tiên (`v1`).
- Người dùng (Moderator) có thể mở Modal trực quan để:
  - **Xóa** những phần AI bịa đặt hoặc không hợp lý (ví dụ: nguồn không chính thống, phân cảnh vô lý).
  - **Thêm** thông tin quan trọng mà AI bỏ sót (ví dụ: tài liệu sách giáo khoa, góc nhìn cá nhân).
  - **Sửa** nhanh tiêu đề, câu từ, độ tin cậy.
- Khi lưu, hệ thống gọi API `DIRECT_EDIT` có sẵn để tạo phiên bản mới `v(N+1)` trên cây lịch sử, sau đó người dùng bấm **Duyệt & Đi tiếp** để chạy các bước tiếp theo dựa trên dữ liệu đã được làm sạch.

Toàn bộ kế hoạch tuân thủ các nguyên tắc:
- **Ngôn ngữ đơn giản, gần gũi**: Dùng từ "Chỉnh sửa", "Thêm", "Xóa", "Lưu thay đổi", không dùng từ ngữ học thuật xa lạ.
- **Tận dụng tối đa Backend hiện có**: Tái sử dụng 100% API `POST /workflows/:id/step-decisions` với action `DIRECT_EDIT` và logic `directEditStep` đã có trong `workflow-transition.service.ts`.
- **Bảo toàn chuẩn dữ liệu (Zod Schema)**: Mọi dữ liệu sửa đổi đều được đảm bảo đúng cấu trúc Zod trước khi gửi về server để không gây lỗi downstream.

---

## 2. Các Giai Đoạn Triển Khai (Phases)

| Giai đoạn | Nội dung | Trạng thái |
| :--- | :--- | :--- |
| **Phase 1** | [Chỉnh sửa nguồn tài liệu cho bước Tìm kiếm (RESEARCHER)](./phase-01-researcher-source-edit-modal.md) | Đã hoàn thành |
| **Phase 2** | [Chỉnh sửa dàn ý kịch bản cho bước Lập dàn ý (STORY_PLANNER)](./phase-02-story-planner-outline-edit-modal.md) | Đã hoàn thành |
| **Phase 3** | [Tích hợp nút chỉnh sửa vào Action Deck & Hỗ trợ sửa JSON dự phòng](./phase-03-action-deck-and-json-fallback.md) | Đã hoàn thành |
| **Phase 4** | [Kiểm thử giao diện, kiểm tra kiểu dữ liệu và luồng chạy thực tế](./phase-04-verification-and-manual-testing.md) | Đã hoàn thành |

---

## 3. Quyết Định Kỹ Thuật Quan Trọng

1. **Modal Popup riêng biệt thay vì sửa trực tiếp trên Card (In-place)**:
   - Khi chỉnh sửa dữ liệu phức tạp (như danh sách nhiều nguồn tài liệu), việc mở Modal riêng biệt giúp người dùng tập trung làm việc, có nút **Lưu thay đổi** và **Hủy bỏ** rõ ràng, tránh vô tình sửa sai dữ liệu gốc đang xem.
2. **Quản lý trạng thái nháp (Draft State) độc lập**:
   - Khi mở Modal, sao chép dữ liệu hiện tại vào state nháp của Modal (`draftSources`, `draftEpisodes`).
   - Mọi thao tác thêm, sửa, xóa chỉ tác động trên state nháp. Chỉ khi bấm "Lưu thay đổi", dữ liệu mới được đóng gói và gửi qua API.
3. **Tự động điền giá trị mặc định cho dữ liệu thêm mới**:
   - Khi người dùng bấm "Thêm nguồn mới", hệ thống tự động sinh `id` duy nhất (`custom-src-${Date.now()}`), gán điểm tin cậy mặc định (ví dụ: `8/10`), gán nhãn `isPrimaryAssertionSource: true` để dữ liệu luôn khớp hoàn hảo với Zod schema `SourceItemSchema`.
4. **Giữ nguyên khả năng sửa JSON thô cho Developer**:
   - Không xóa bỏ ô sửa JSON thô hiện tại mà chuyển nó vào một tab phụ "Nâng cao: Sửa JSON trực tiếp", phòng trường hợp muốn can thiệp sâu vào các trường đặc biệt.

---

## 4. Kịch Bản Demo Cho Thầy

1. Tạo một chủ đề nghiên cứu (ví dụ: *Chiến dịch Điện Biên Phủ*).
2. Agent `RESEARCHER` chạy xong, danh sách 21 nguồn hiện ra ở Trạm dừng 0.
3. Người dùng bấm nút **✏️ Chỉnh sửa danh sách nguồn**:
   - Bấm nút **Xóa (🗑️)** một nguồn từ trang web không đáng tin cậy.
   - Bấm nút **+ Thêm nguồn mới**: Nhập tên *Đại tướng Võ Nguyên Giáp - Điểm hẹn lịch sử*, nguồn viện dẫn, link tài liệu.
   - Bấm nút **Lưu thay đổi**.
4. Hệ thống tạo ngay bản `v2`, cây lịch sử hiển thị nhánh `v2 (Chỉnh sửa trực tiếp)`.
5. Người dùng bấm **Duyệt & Đi tiếp →**: Các agent phía sau chạy mượt mà với danh sách nguồn đã được chọn lọc chuẩn xác.
