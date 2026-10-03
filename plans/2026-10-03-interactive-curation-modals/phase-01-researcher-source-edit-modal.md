---
title: "Phase 1: Chỉnh sửa nguồn tài liệu cho bước Tìm kiếm (RESEARCHER)"
description: "Xây dựng SourceEditModal cho phép người dùng xem, xóa nguồn không đáng tin, thêm nguồn mới và sửa thông tin nguồn trước khi duyệt."
status: pending
priority: P1
effort: 1.5h
branch: main
tags: [frontend, researcher, modal, curation]
created: 2026-10-03
---

# Phase 1: Chỉnh sửa nguồn tài liệu cho bước Tìm kiếm (RESEARCHER)

## 1. Mục tiêu
Cho phép người dùng trực tiếp quản lý danh sách nguồn tài liệu do Agent Tìm kiếm (RESEARCHER) thu thập được:
- Xóa các nguồn bịa đặt, sai lệch hoặc chất lượng thấp.
- Bổ sung tài liệu uy tín bên ngoài mà AI bỏ sót.
- Sửa nhanh tên, tác giả, nhóm tài liệu và độ tin cậy.

## 2. Chi tiết thực hiện

### 2.1. Xây dựng component `SourceEditModal` (`apps/web/components/source-edit-modal.tsx`)
- **Props**:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `sources: SourceItem[]`
  - `onSave: (newSources: SourceItem[]) => Promise<void>`
  - `isSubmitting: boolean`
- **Giao diện chính**:
  - Header: Tiêu đề "Chỉnh sửa danh sách nguồn tài liệu" kèm đếm số lượng nguồn hiện có.
  - Thanh tìm kiếm và nút "+ Thêm nguồn mới".
  - Danh sách thẻ nguồn (Cards list):
    - Mỗi thẻ hiển thị: Tên nguồn, Tác giả, Nhãn nhóm nguồn (Tier 1 Chính sử, Tier 2 Khảo cổ...), Thanh điểm tin cậy.
    - Nút **Sửa (✏️)**: Chuyển thẻ thành ô nhập để sửa nhanh tên, tác giả, tier.
    - Nút **Xóa (🗑️)**: Xóa ngay nguồn khỏi danh sách nháp.
  - Form thêm nguồn mới (khi bấm "+ Thêm nguồn mới"):
    - Tên tài liệu / bài viết (bắt buộc).
    - Tác giả hoặc cơ quan ban hành (bắt buộc).
    - Nhóm nguồn (chọn từ 4 Tier: Chính sử, Khảo cổ, Khoa học, Dã sử).
    - Điểm tin cậy (thanh trượt hoặc chọn từ 1 đến 10, mặc định 8).
    - Đường dẫn URL (tùy chọn).
    - Tự động sinh `id` duy nhất và điền các trường mặc định hợp lệ của `SourceItemSchema`.
  - Footer: Nút "Hủy bỏ" và nút "Lưu thay đổi (tạo phiên bản mới)".

### 2.2. Tích hợp vào `NarrativeMenuCard` (`apps/web/components/narrative-menu-card.tsx`)
- Thêm nút nổi bật **✏️ Chỉnh sửa danh sách nguồn** ngay trên thanh tiêu đề của danh sách nguồn.
- Khi bấm nút, mở `SourceEditModal`.
- Khi người dùng bấm lưu, gọi hàm `onDirectEdit` được truyền từ `page.tsx`:
  - Tạo object payload mới: giữ nguyên toàn bộ trường của `ResearchConsultation`, chỉ thay thế `sourcesCatalogue` bằng danh sách mới.
  - Gọi `handleDirectEdit("RESEARCHER", activeVersion, updatedConsultation, "Chỉnh sửa danh sách nguồn tài liệu")`.
  - Backend tạo phiên bản `v(N+1)`, UI tự động chuyển sang phiên bản mới.

## 3. Tiêu chí hoàn thành (Definition of Done)
1. Bấm mở modal mượt mà, hiển thị đúng 100% các nguồn hiện có.
2. Bấm nút xóa (🗑️) thì nguồn biến mất ngay lập tức trong danh sách nháp.
3. Thêm được nguồn mới với đầy đủ thông tin hợp lệ.
4. Bấm "Lưu thay đổi" gọi API thành công, hệ thống tăng lên phiên bản mới và không bị lỗi schema Zod.
5. Danh sách nguồn ở bản mới phản ánh đúng các thay đổi vừa thực hiện.
