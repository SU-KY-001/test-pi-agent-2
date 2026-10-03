---
title: "Phase 2: Chỉnh sửa dàn ý kịch bản cho bước Lập dàn ý (STORY_PLANNER)"
description: "Xây dựng StoryOutlineEditModal cho phép chỉnh sửa tiêu đề tập, thêm/sửa/xóa các nhịp kể (narrative beats) và hook kết thúc của 3 tập kịch bản."
status: pending
priority: P1
effort: 1.5h
branch: main
tags: [frontend, story-planner, modal, curation]
created: 2026-10-03
---

# Phase 2: Chỉnh sửa dàn ý kịch bản cho bước Lập dàn ý (STORY_PLANNER)

## 1. Mục tiêu
Cho phép người dùng chỉnh sửa cấu trúc kịch bản 3 tập do Agent Lập dàn ý (STORY_PLANNER) sinh ra trước khi chuyển sang bước viết kịch bản chi tiết:
- Đổi tên tập cho hấp dẫn hơn.
- Thêm, bớt hoặc sửa nội dung các nhịp kể (narrative beats) trong từng tập.
- Sửa lại câu hỏi chủ đề hoặc đoạn kết gây tò mò (hook).

## 2. Chi tiết thực hiện

### 2.1. Xây dựng component `StoryOutlineEditModal` (`apps/web/components/story-outline-edit-modal.tsx`)
- **Props**:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `outline: StoryOutline`
  - `onSave: (newOutline: StoryOutline) => Promise<void>`
  - `isSubmitting: boolean`
- **Giao diện chính**:
  - Header: Tiêu đề kịch bản tổng thể (`seriesTitle`) và trọng tâm kể.
  - Bộ chọn 3 tập (Tab chuyển đổi: Tập 1, Tập 2, Tập 3).
  - Nội dung từng tập:
    - **Tiêu đề tập**: Ô nhập văn bản để sửa tên tập.
    - **Câu hỏi trung tâm**: Ô nhập câu hỏi mấu chốt của tập.
    - **Danh sách nhịp kể (Narrative Beats)**:
      - Danh sách các câu nhịp kể theo thứ tự từ trên xuống dưới.
      - Mỗi nhịp kể là một ô nhập văn bản (Textarea tự co giãn hoặc Input).
      - Nút **Xóa (🗑️)** bên cạnh mỗi nhịp kể.
      - Nút **"+ Thêm nhịp kể mới"** ở cuối danh sách.
    - **Đoạn kết nối / Hook kết tập**: Ô nhập câu chốt tạo sự tò mò cho tập kế tiếp.
  - Footer: Nút "Hủy bỏ" và nút "Lưu thay đổi (tạo phiên bản mới)".

### 2.2. Tích hợp vào bước duyệt `STORY_PLANNER`
- Khi `STORY_PLANNER` ở trạng thái chờ duyệt (`WAITING_FOR_HUMAN`), hiển thị nút **✏️ Chỉnh sửa dàn ý 3 tập** bên cạnh nút duyệt tiếp.
- Khi người dùng bấm lưu, gọi hàm `handleDirectEdit("STORY_PLANNER", activeVersion, updatedOutline, "Chỉnh sửa dàn ý kịch bản")`.
- Backend sinh ra phiên bản mới `v(N+1)` và UI tự động chuyển sang hiển thị bản mới để người dùng bấm duyệt sang bước viết kịch bản chi tiết (`SCRIPT_WRITER`).

## 3. Tiêu chí hoàn thành (Definition of Done)
1. Chuyển đổi qua lại giữa 3 tập mượt mà, giữ nguyên dữ liệu đang sửa của từng tập.
2. Thêm mới nhịp kể và xóa nhịp kể hoạt động tức thì.
3. Khi bấm "Lưu thay đổi", dữ liệu được kiểm tra hợp lệ với `StoryOutlineSchema` (đúng cấu trúc tuple 3 tập).
4. Hệ thống ghi nhận phiên bản mới thành công, các bước viết sau đó đọc đúng dàn ý đã sửa.
