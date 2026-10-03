---
title: "Phase 3: Tích hợp nút chỉnh sửa vào Action Deck & Hỗ trợ sửa JSON dự phòng"
description: "Cải tiến ActionDeck và StepCard để hiển thị nút mở Modal chỉnh sửa trực quan một cách nổi bật, đồng thời giữ ô sửa JSON thô ở dạng tùy chọn nâng cao."
status: pending
priority: P2
effort: 1h
branch: main
tags: [frontend, action-deck, ux]
created: 2026-10-03
---

# Phase 3: Tích hợp nút chỉnh sửa vào Action Deck & Hỗ trợ sửa JSON dự phòng

## 1. Mục tiêu
- Tạo trải nghiệm người dùng liền mạch tại khu vực hành động của các trạm dừng (`ActionDeck`).
- Thay thế nút sửa JSON thô cồng kềnh bằng nút mở Modal chỉnh sửa trực quan, thân thiện.
- Giữ lại tính năng sửa JSON thô dưới dạng tùy chọn "Nâng cao" cho lập trình viên.

## 2. Chi tiết thực hiện

### 2.1. Cải tiến `ActionDeck` (`apps/web/components/action-deck.tsx`)
- Phân loại nút thao tác:
  - Nếu bước hiện tại hỗ trợ Modal trực quan (`RESEARCHER`, `STORY_PLANNER`): hiển thị nút chính **`✏️ Chỉnh sửa kết quả`**. Bấm vào sẽ mở Modal tương ứng của bước đó.
  - Đối với các bước khác hoặc khi cần can thiệp sâu: có thêm nút phụ dạng dropdown hoặc link mờ **`{ } Sửa JSON thô`**.
- Chuẩn hóa ngôn ngữ trong toàn bộ component:
  - Dùng các từ đơn giản: "Chỉnh sửa kết quả", "Lưu thay đổi", "Duyệt kết quả", "Hủy bỏ".
  - Bỏ các từ ngữ rườm rà không cần thiết.

### 2.2. Kết nối trạng thái với `StepCard` và `page.tsx`
- Truyền callback mở Modal từ `StepCard` / `NarrativeMenuCard` vào `ActionDeck` và ngược lại.
- Khi một phiên bản mới được lưu qua Modal:
  - Tự động đóng Modal.
  - Tự động cập nhật `activeVersions[stepType]` lên phiên bản mới vừa tạo.
  - Hiển thị thông báo nhỏ: "Đã lưu bản chỉnh sửa mới (vN+1)".

## 3. Tiêu chí hoàn thành (Definition of Done)
1. Giao diện sạch sẽ, không còn đập ngay vào mắt ô Textarea JSON to đùng.
2. Nút "Chỉnh sửa kết quả" hiển thị rõ ràng, dễ bấm trên cả màn hình lớn và nhỏ.
3. Khi cần thiết vẫn mở được ô sửa JSON thô và có kiểm tra lỗi cú pháp đầy đủ.
