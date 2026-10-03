---
title: "Phase 4: Kiểm thử giao diện, kiểm tra kiểu dữ liệu và luồng chạy thực tế"
description: "Chạy typecheck, build ứng dụng và kiểm chứng thực tế toàn bộ luồng chỉnh sửa (thêm/sửa/xóa) trên trình duyệt."
status: pending
priority: P1
effort: 0.5h
branch: main
tags: [testing, verification, build]
created: 2026-10-03
---

# Phase 4: Kiểm thử giao diện, kiểm tra kiểu dữ liệu và luồng chạy thực tế

## 1. Mục tiêu
- Đảm bảo toàn bộ mã nguồn không có lỗi TypeScript (`bun run typecheck`).
- Đảm bảo ứng dụng Next.js và API đóng gói thành công (`bun run build`).
- Kiểm chứng thực tế trên trình duyệt rằng luồng thêm/sửa/xóa hoạt động trơn tru và các Agent downstream nhận đúng dữ liệu đã chỉnh sửa.

## 2. Các bước kiểm chứng

### 2.1. Kiểm tra tĩnh (Static Analysis)
1. Chạy lệnh kiểm tra kiểu dữ liệu toàn bộ monorepo:
   ```bash
   bun run typecheck
   ```
   *Yêu cầu: Không có bất kỳ lỗi type nào ở cả `apps/web`, `apps/api` và `packages/contracts`.*

2. Chạy lệnh build:
   ```bash
   bun run build
   ```
   *Yêu cầu: Next.js 15 build thành công bundle production.*

### 2.2. Kiểm thử luồng thực tế trên trình duyệt (`localhost:3000`)
1. **Kiểm thử Gate 0 (RESEARCHER)**:
   - Tạo một workflow với chủ đề thực tế.
   - Khi bước Tìm kiếm hoàn thành, bấm nút **✏️ Chỉnh sửa danh sách nguồn**.
   - Bấm nút **Xóa (🗑️)** một nguồn trong danh sách -> Nguồn biến mất khỏi bảng.
   - Bấm nút **+ Thêm nguồn mới** -> Nhập thông tin một cuốn sách hoặc tài liệu -> Nguồn xuất hiện trong danh sách.
   - Bấm **Lưu thay đổi** -> Hệ thống tạo bản `v2`, modal tự đóng, thông báo lưu thành công.
   - Bấm **Duyệt & Đi tiếp →** -> Hệ thống kích hoạt bước Thẩm định nguồn và Trích xuất sự kiện với đúng danh sách nguồn mới.

2. **Kiểm thử Gate 1 (STORY_PLANNER)**:
   - Khi bước Lập dàn ý hoàn thành, bấm nút **✏️ Chỉnh sửa dàn ý kịch bản**.
   - Sửa tiêu đề tập 1.
   - Thêm một nhịp kể mới vào tập 2.
   - Xóa một nhịp kể không cần thiết ở tập 3.
   - Bấm **Lưu thay đổi** -> Tạo bản `v2`.
   - Bấm **Duyệt & Đi tiếp →** -> Bước Viết kịch bản (`SCRIPT_WRITER`) chạy và viết dựa trên đúng dàn ý đã chỉnh sửa.

3. **Kiểm tra cây thực thi (Execution Tree)**:
   - Mở cây thực thi, kiểm tra các node được tạo bằng cách chỉnh sửa trực tiếp hiển thị rõ ràng thông tin phiên bản và liên kết phả hệ cha-con.
