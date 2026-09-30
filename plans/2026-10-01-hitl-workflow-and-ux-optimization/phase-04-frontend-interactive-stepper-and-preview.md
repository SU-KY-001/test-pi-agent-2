# Phase 4: Frontend Interactive Stepper & Live Preview

## Overview
- **Priority**: P1 (User Experience & Interaction)
- **Status**: Pending
- **Estimate**: 2h
- **Mục tiêu**: Tái thiết kế trải nghiệm người dùng trên `apps/web`: Split View bố cục 2 cột (Interactive Stepper bên trái, Live Preview bên phải), hiển thị nhịp thở của Agent (Micro-summary & Thinking drawer), tách bạch 2 hành động Rerun vs Continue, tích hợp Quick Action Chips và Direct In-Place Edit.

---

## Key Insights
1. **Tránh nhiễu thị giác**: Không nhồi nhét log kỹ thuật tràn ngập màn hình; mỗi StepCard chỉ hiển thị tóm tắt ngắn (Model, thời gian chạy, số version) và ẩn chi tiết vào Drawer/Accordion "Thinking / Trace".
2. **Loại bỏ sự nhầm lẫn giữa Sửa vs Đi tiếp**: Tách thành 2 card thao tác riêng biệt với màu sắc phân biệt:
   - Màu Amber/Orange: "Yêu cầu Agent sửa lại" (Rerun Step).
   - Màu Emerald/Blue: "Duyệt & Chuyển sang bước tiếp" (Continue Step).
3. **Tiết kiệm thời gian (Quick Action Chips)**: Bấm 1 click để điền ngay các câu dặn phổ biến thay vì phải gõ bàn phím từ đầu.
4. **Quyền năng tối thượng (In-Place Edit)**: Khi Agent chỉ viết sai 1 chữ hoặc người dùng muốn sửa nhanh 1 câu, cho phép sửa trực tiếp và tiếp tục ngay mà không mất thời gian đợi LLM gọi lại.

---

## Requirements

### 1. Functional Requirements
- **`apps/web/lib/workflow-api.ts`**:
  - `rerunStep(workflowId, stepType, payload: { version, feedback })`
  - `continueStep(workflowId, stepType, payload: { version, guidance })`
  - `directEditStep(workflowId, stepType, payload: { version, outputJson })`
- **Tái cấu trúc bố cục Split View (`apps/web/app/page.tsx`)**:
  - Cột trái (60%): Interactive Workflow Stepper (Extractor $\rightarrow$ Planner $\rightarrow$ Writer $\rightarrow$ Reviewer).
  - Cột phải (40%): Live Preview & Output Inspector + Tab SSE Trace Events.
- **Linh kiện `StepCard` (`apps/web/components/step-card.tsx`)**:
  - Header: Tên bước, Icon đại diện, Status Badge (`RUNNING` pulsing, `WAITING_FOR_HUMAN` action required, `COMPLETED`, `STALE`).
  - Micro-Summary Bar: Model used, Execution duration, Version count.
  - Tab Switcher: Xem lại các version lịch sử (v1, v2...).
  - Accordion: "Thinking / Execution Log" (lọc các sự kiện liên quan tới step từ `system_events`).
- **Review Gate Action Deck (khi status = `WAITING_FOR_HUMAN`)**:
  - **Khối 1: Yêu cầu Agent sửa lại (Rerun)**:
    - Textarea góp ý.
    - Quick Action Chips: `[Ngắn gọn hơn]`, `[Nhấn mạnh bảo hành]`, `[Bỏ emoji]`, `[Tăng tính thuyết phục]`.
    - Nút `Rerun with Feedback` (Amber button).
  - **Khối 2: Duyệt & Dặn dò downstream (Continue)**:
    - Textarea dặn dò bước sau (`incomingGuidance`).
    - Quick Action Chips: `[Dùng tone hóm hỉnh]`, `[Soi kỹ thông số kỹ thuật]`, `[Viết tối giản dưới 100 từ]`.
    - Nút `Approve & Continue` (Emerald button).
  - **Khối 3: Sửa trực tiếp (In-Place Edit)**:
    - Nút chuyển chế độ `Chỉnh sửa trực tiếp`.
    - Editor textarea/JSON cho phép user trực tiếp sửa headline, body...
    - Nút `Save & Continue` gửi payload lên API.
- **Cột phải (Live Ad Preview)**:
  - Render bản xem trước trực quan của bài viết quảng cáo: Headline to rõ, Body copy, CTA button, Target platforms, Bullet highlights.
  - Nút `Copy Quảng cáo` (1 click copy to clipboard).

### 2. Non-Functional Requirements
- Chuẩn giao tiếp thuần HTTP/SSE sang `apps/api` (port 3001), tuyệt đối không import `@repo/db`.
- Phản hồi giao diện mượt mà, optimistic update trạng thái nút khi bấm để tránh double-click ở client.

---

## Architecture & Component Hierarchy

```
Page (page.tsx) - Split View
 ├── Header (Create Workflow & Global Status)
 ├── Left Column (60%): Stepper Container
 │    ├── StepCard (EXTRACTOR)
 │    ├── StepCard (PLANNER)
 │    │    └── ActionDeck (Waiting for Human)
 │    │         ├── RerunForm + QuickChips
 │    │         ├── ContinueForm + QuickChips
 │    │         └── InPlaceEditToggle
 │    ├── StepCard (WRITER)
 │    │    └── ActionDeck (Waiting for Human)
 │    └── StepCard (REVIEWER)
 └── Right Column (40%): Sticky Inspector
      ├── Tab 1: Live Ad Preview (Styled Card + Copy button)
      ├── Tab 2: Raw Output (JSON Viewer)
      └── Tab 3: Trace Stream (TracePanel SSE)
```

---

## Related Code Files

### Files to Create:
- `apps/web/components/step-card.tsx`
- `apps/web/components/action-deck.tsx`
- `apps/web/components/live-ad-preview.tsx`
- `apps/web/components/quick-chips.tsx`

### Files to Modify:
- `apps/web/lib/workflow-api.ts`
- `apps/web/app/page.tsx`

---

## Implementation Steps

1. **Cập nhật `apps/web/lib/workflow-api.ts`**:
   - Khai báo hàm `rerunStep()`, `continueStep()`, `directEditStep()`.
2. **Xây dựng `quick-chips.tsx`**:
   - Component hiển thị danh sách chip bấm vào tự điền text vào textarea.
3. **Xây dựng `action-deck.tsx`**:
   - Bao gồm form Rerun, form Continue, và toggle In-Place Edit.
4. **Xây dựng `step-card.tsx`**:
   - Hiển thị thông tin step, tabs version, micro-summary, accordion log và nhúng `ActionDeck` khi cần review.
5. **Xây dựng `live-ad-preview.tsx`**:
   - Hiển thị bài viết quảng cáo hoàn chỉnh dạng card sang trọng kèm nút Copy.
6. **Refactor `apps/web/app/page.tsx`**:
   - Thay đổi layout thành Split View 2 cột responsive (`grid grid-cols-1 lg:grid-cols-12 gap-6`).

---

## Todo List
- [ ] Mở rộng typed client trong `apps/web/lib/workflow-api.ts`
- [ ] Tạo `apps/web/components/quick-chips.tsx`
- [ ] Tạo `apps/web/components/action-deck.tsx`
- [ ] Tạo `apps/web/components/step-card.tsx`
- [ ] Tạo `apps/web/components/live-ad-preview.tsx`
- [ ] Tái cấu trúc `apps/web/app/page.tsx` sang Split View
- [ ] Kiểm tra typecheck toàn monorepo: `bun run typecheck`

---

## Success Criteria
- Giao diện hiển thị rõ ràng 2 cột; khi Agent đang chạy có spinner và micro-summary.
- Khi dừng ở Planner hoặc Writer, xuất hiện Review Gate với 2 lựa chọn rõ ràng: Rerun hoặc Continue.
- Bấm Quick Action Chip điền ngay nội dung dặn dò; bấm Approve chuyển bước mượt mà.
- Live Ad Preview hiển thị ngay khi Writer có output.
