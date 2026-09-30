# Phase 5: Verification & Manual Probes

## Overview
- **Priority**: P1 (Verification & Quality Assurance)
- **Status**: Pending
- **Estimate**: 1h
- **Mục tiêu**: Kiểm chứng toàn diện tính toàn vẹn của hệ thống, độ an toàn của luồng HITL 2 chặng và độ hoàn thiện của giao diện UX thông qua static analysis và live subsystem probes mà KHÔNG tạo bất kỳ file test tự động nào (tuân thủ nghiêm ngặt chính sách dự án).

---

## Policy Compliance
- **Chính sách Testing của Repo**: Dự án này **tuyệt đối không** duy trì hoặc tạo các bộ test tự động (`bun:test`, Jest, Vitest, Playwright...).
- **Chỉ thị của người dùng**: *"không cần test nhé"*.
- **Phương pháp kiểm chứng**: Sử dụng Type Safety (`tsc --noEmit`), Build Integrity (`bun run build`), và Active Endpoint / UI Probes.

---

## Verification Plan

### 1. Static Analysis & Build Verification
1. **Type Safety Across Workspaces**:
   ```bash
   bun run typecheck
   ```
   - Xác nhận `@repo/contracts`, `@repo/db`, `apps/api`, và `apps/web` không còn bất kỳ lỗi TypeScript nào.
2. **Production Build Integrity**:
   ```bash
   bun run build
   ```
   - Xác nhận Next.js App Router biên dịch thành công, không bị lỗi SSR/Client Component hoặc lỗi import chéo package.

### 2. Backend Active Probes (Manual Endpoint Walkthrough)
Thực hiện các lệnh gọi mẫu bằng `curl` hoặc REST client:

1. **System Health Check**:
   ```bash
   curl -s http://localhost:3001/health | jq
   ```
   - Kỳ vọng: `{ "status": "ok", "services": { "api": true, "database": true, "queue": true, "pi": true } }`.

2. **Khởi tạo Workflow mới**:
   ```bash
   curl -s -X POST http://localhost:3001/workflows \
     -H "Content-Type: application/json" \
     -d '{"productRawText": "Bình giữ nhiệt Titan 800ml, giữ nóng 18h, giữ lạnh 24h, bảo hành 10 năm trọn đời."}' | jq
   ```
   - Lấy `workflowId`. Extractor tự chạy $\rightarrow$ Planner tự chạy $\rightarrow$ Step Planner chuyển sang `WAITING_FOR_HUMAN`.

3. **Kiểm tra trạng thái Gate Planner**:
   ```bash
   curl -s http://localhost:3001/workflows/<id> | jq '.steps[] | {type, status, currentVersion, reviewPolicy}'
   ```
   - Kỳ vọng: `PLANNER` có `status: "WAITING_FOR_HUMAN"`, `currentVersion: 1`, `reviewPolicy: "REVIEW_REQUIRED"`.

4. **Kiểm tra Rerun Planner với Feedback**:
   ```bash
   curl -s -X POST http://localhost:3001/workflows/<id>/steps/PLANNER/rerun \
     -H "Content-Type: application/json" \
     -d '{"version": 1, "feedback": "Tập trung thêm vào yếu tố bảo hành trọn đời"}' | jq
   ```
   - Kỳ vọng: Trả về 200, Planner được đưa về hàng đợi, sinh ra `version: 2` và tiếp tục dừng ở `WAITING_FOR_HUMAN`.

5. **Kiểm tra Concurrency / Double-Click Prevention**:
   - Gửi đồng thời 2 lệnh Continue cho Planner version 2:
     - Request 1: Trả về `200 OK`.
     - Request 2: Trả về `409 Conflict` (Optimistic Locking kích hoạt thành công).

6. **Kiểm tra Gate Writer**:
   - Chờ Writer hoàn thành $\rightarrow$ kiểm tra status của `WRITER` là `WAITING_FOR_HUMAN` (Review Gate thứ 2).
   - Reviewer chưa được chạy.

7. **Kiểm tra Continue Writer sang Reviewer**:
   ```bash
   curl -s -X POST http://localhost:3001/workflows/<id>/steps/WRITER/continue \
     -H "Content-Type: application/json" \
     -d '{"version": 1, "guidance": "Soi kỹ thông số 18 giờ giữ nhiệt"}' | jq
   ```
   - Kỳ vọng: Reviewer được kích hoạt với guidance, chạy fact-check $\rightarrow$ kết thúc workflow với status `COMPLETED`.

### 3. Frontend Interactive UX Walkthrough (Localhost:3000)
1. **Kiểm tra Split View Layout**:
   - Truy cập `http://localhost:3000`.
   - Xác nhận bố cục 2 cột (Cột trái Stepper & Execution Deck, Cột phải Live Preview & Output Inspector).
2. **Kiểm tra Micro-Summary & Thinking Drawer**:
   - Quan sát nhịp chạy của Agent: hiển thị Model, Duration và badge trạng thái.
   - Nhấp vào accordion "Thinking / Execution Log" để xem các sự kiện log chi tiết.
3. **Kiểm tra Review Gate Interaction**:
   - Tại Planner: Bấm vào Quick Action Chip (ví dụ: "Nhấn mạnh bảo hành") $\rightarrow$ text tự điền vào textarea.
   - Thử tính năng In-Place Direct Edit: Chỉnh sửa trực tiếp headline $\rightarrow$ bấm Save & Continue.
4. **Kiểm tra Live Ad Preview**:
   - Khi bước Writer hoàn thành, cột phải tự động hiển thị card quảng cáo trực quan đẹp mắt.
   - Bấm nút "Copy Quảng cáo" $\rightarrow$ clipboard nhận đúng toàn bộ bài viết.

---

## Todo List
- [ ] Chạy `bun run typecheck` trên toàn monorepo
- [ ] Chạy `bun run build` xác nhận build thành công
- [ ] Chạy probe backend qua `curl` xác nhận luồng HITL 2 chặng và optimistic locking (409)
- [ ] Kiểm tra giao diện `localhost:3000` (Split View, Quick Chips, In-Place Edit, Live Ad Preview)

---

## Success Criteria
- Toàn bộ monorepo pass 100% typecheck và build mà không có lỗi.
- Workflow vận hành trơn tru qua 2 chặng Human-in-the-loop (Planner và Writer).
- Không xuất hiện bất kỳ file test tự động nào mới.
