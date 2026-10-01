# SỔ TAY HƯỚNG DẪN SỬ DỤNG HỆ THỐNG
## SỬ KÝ AGENT STUDIO — MULTI-AGENT AD PIPELINE (HITL)

> **Mã tài liệu**: `SUM-SK-001`  
> **Tiêu chuẩn thiết kế tài liệu**: Tuân thủ chuẩn quốc tế **IEEE Std 1063-2001** & **ISO/IEC/IEEE 26514** (Software User Documentation)  
> **Phiên bản hệ thống**: 1.2.0 (Hỗ trợ 2-Stage HITL, Forward Guidance & Split View UI)  
> **Môi trường vận hành**: Local-first, Zero-external-daemon (Bun 1.4+, Next.js 15, Hono, PGlite, pg-boss, Pi SDK)

---

## MỤC LỤC

1. [Tổng quan hệ thống (System Overview)](#1-tổng-quan-hệ-thống-system-overview)
   - 1.1. Giới thiệu sản phẩm
   - 1.2. Kiến trúc Local-First & Zero-Daemon
   - 1.3. Mô hình luồng dữ liệu 4 Agent & 2 Cổng HITL
2. [Yêu cầu hệ thống & Khởi chạy (Getting Started)](#2-yêu-cầu-hệ-thống--khởi-chạy-getting-started)
   - 2.1. Yêu cầu phần cứng và phần mềm
   - 2.2. Biến môi trường cấu hình (.env)
   - 2.3. Lệnh khởi động hệ thống
   - 2.4. Kiểm tra sức khỏe dịch vụ (Health Check)
3. [Tổng quan giao diện người dùng (UI Walkthrough)](#3-tổng-quan-giao-diện-người-dùng-ui-walkthrough)
   - 3.1. Bố cục Split View 2 cột
   - 3.2. Cột trái: Khối nhập liệu & Stepper 4 bước
   - 3.3. Cột phải: Bảng điều khiển đa năng (Live Preview, Trace SSE, JSON)
   - 3.4. Bảng điều khiển can thiệp người dùng (Action Deck)
4. [Hướng dẫn thao tác từng bước (Step-by-Step Task Guides)](#4-hướng-dẫn-thao-tác-từng-bước-step-by-step-task-guides)
   - 4.1. Khởi tạo một quy trình tạo quảng cáo mới
   - 4.2. Thao tác tại Cổng duyệt 1: Kế hoạch nội dung (Planner)
   - 4.3. Sử dụng Quick Action Chips để ra lệnh nhanh
   - 4.4. Chỉnh sửa trực tiếp (In-Place Edit) không tốn token LLM
   - 4.5. Thao tác tại Cổng duyệt 2: Soạn thảo quảng cáo (Writer)
   - 4.6. Yêu cầu viết lại (Rerun) & So sánh giữa các phiên bản (Version Switcher)
   - 4.7. Kiểm tra kết quả thẩm định sự thật (Reviewer) & Sao chép bài viết
5. [Cơ chế chuyên sâu & Nguyên lý hoạt động (Deep-Dive)](#5-cơ-chế-chuyên-sâu--nguyên-lý-hoạt-động-deep-dive)
   - 5.1. Phân biệt Lời dặn bước tiếp (Guidance) vs Góp ý sửa lại (Feedback)
   - 5.2. Cơ chế vô hiệu hóa hạ nguồn (Downstream Invalidation & Trạng thái STALE)
   - 5.3. Khóa lạc quan chống Race Condition & Double-Click
6. [Giám sát & Nhật ký vận hành (Observability)](#6-giám-sát--nhật-ký-vận-hành-observability)
   - 7.1. Theo dõi dòng sự kiện thời gian thực (SSE Stream)
   - 7.2. Kiểm tra Raw JSON trạng thái
7. [Xử lý sự cố thường gặp (Troubleshooting)](#7-xử-lý-sự-cố-thường-gặp-troubleshooting)
   - 7.1. Lỗi kiểm tra điểm phục hồi PGlite (WASM Checkpoint / Panic)
   - 7.2. Lỗi kết nối AI Provider / Model Timeout
   - 7.3. Nút bấm bị vô hiệu hóa hoặc không phản hồi
8. [Câu hỏi thường gặp & Thực hành tốt nhất (FAQ & Best Practices)](#8-câu-hỏi-thường-gặp--thực-hành-tốt-nhất-faq--best-practices)
9. [Thuật ngữ chuyên ngành (Glossary)](#9-thuật-ngữ-chuyên-ngành-glossary)

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

### 1.1. Giới thiệu sản phẩm
**Sử Ký Agent Studio** là một nền tảng sáng tạo nội dung quảng cáo tự động hóa dựa trên kiến trúc **Multi-Agent** (Đa tác tử AI) kết hợp với cơ chế **Human-In-The-Loop (HITL)** hai giai đoạn. Hệ thống chuyển đổi những thông tin sản phẩm thô sơ thành các bài viết quảng cáo hấp dẫn, chuẩn marketing, đồng thời được kiểm chứng sự thật chặt chẽ để loại bỏ hoàn toàn hiện tượng "ảo giác" (hallucination) của mô hình ngôn ngữ lớn (LLM).

### 1.2. Kiến trúc Local-First & Zero-Daemon
Hệ thống được thiết kế theo triết lý **Local-First**, chứng minh khả năng vận hành ổn định một stack hoàn chỉnh mà **không cần bất kỳ daemon bên ngoài nào** (Zero Docker, Zero Redis, Zero external PostgreSQL server):

- **Next.js 15 (React 19)**: Frontend App Router cung cấp giao diện Split View trực quan.
- **Hono trên Bun 1.4+**: Backend API hiệu năng cao, điều phối toàn bộ vòng đời tác vụ.
- **PGlite**: Cơ sở dữ liệu PostgreSQL nhúng chạy trực tiếp trong tiến trình API qua WebAssembly, lưu trữ file tại `./packages/db/data/pgdata`.
- **pg-boss**: Hàng đợi tác vụ (Job Queue) chạy nền, kết nối trực tiếp với PGlite qua driver `fromPglite`.
- **Pi SDK & OpenCode Go**: Điều phối các phiên làm việc của tác tử AI một cách an toàn và tạm thời (ephemeral sessions).

```
Trình duyệt Web (Client: localhost:3000)
       │ HTTP REST & SSE Stream
       ▼
Ứng dụng API (Hono: localhost:3001) ── [Runtime Owner Duy Nhất]
       ├── Drizzle ORM ──────────┐
       ├── pg-boss (Job Queue) ──┼──▶ PGlite nhúng (./packages/db/data/pgdata)
       └── Pi SDK (Model Runtime)┴──▶ OpenCode Go Provider
```

### 1.3. Mô hình luồng dữ liệu 4 Agent & 2 Cổng HITL
Quy trình sản xuất bài viết trải qua 4 bước tuần tự với 2 cổng kiểm soát con người:

```
[Mô tả sản phẩm thô]
       │
       ▼
 [1. EXTRACTOR]  ── Tự động bóc tách dữ kiện kỹ thuật (dung tích, nhiệt độ, giá, vật liệu...)
       │
       ▼
  [2. PLANNER]   ── Lập kế hoạch (đối tượng, tone giọng, góc tiếp cận, headline direction)
       │
 ╔═════╧════════════════════════════════════════════════════════════════════╗
 ║ [CỔNG DUYỆT 1 - HITL] Con người kiểm duyệt:                              ║
 ║  • Rerun: Yêu cầu AI đổi góc nhìn hoặc tone giọng                        ║
 ║  • Direct Edit: Tự chỉnh sửa trực tiếp JSON kế hoạch                     ║
 ║  • Continue: Duyệt kế hoạch + Kèm lời dặn dò cho bước viết               ║
 ╚═════╤════════════════════════════════════════════════════════════════════╝
       │ (Kèm Incoming Guidance)
       ▼
  [3. WRITER]    ── Soạn thảo bài viết quảng cáo hoàn chỉnh (Headline, Body, CTA)
       │
 ╔═════╧════════════════════════════════════════════════════════════════════╗
 ║ [CỔNG DUYỆT 2 - HITL] Con người thẩm định bài viết:                      ║
 ║  • Rerun: Bắt AI viết lại bản thảo theo góp ý mới                        ║
 ║  • Direct Edit: Tự sửa câu chữ tiêu đề, nội dung                         ║
 ║  • Continue: Duyệt bản thảo + Dặn dò kiểm chứng                          ║
 ╚═════╤════════════════════════════════════════════════════════════════════╝
       │ (Bản thảo đã duyệt + Dữ kiện gốc)
       ▼
 [4. REVIEWER]   ── Đối chiếu từng câu chữ với dữ kiện sản phẩm gốc
       │
       ▼
 [BÀI QUẢNG CÁO HOÀN TẤT & ĐÃ XÁC THỰC]
```

---

## 2. YÊU CẦU HỆ THỐNG & KHỞI CHẠY (GETTING STARTED)

### 2.1. Yêu cầu phần cứng và phần mềm
- **Hệ điều hành**: Windows 10/11, macOS (Apple Silicon hoặc Intel), hoặc Linux (Ubuntu 20.04+).
- **Node Runtime**: **Bun 1.4.0+** (Bắt buộc; hệ thống không sử dụng `npm`, `yarn` hay `pnpm`).
- **RAM**: Tối thiểu 4 GB (Khuyến nghị 8 GB trở lên).
- **Dung lượng đĩa trống**: Tối thiểu 1 GB cho mã nguồn và thư mục lưu trữ CSDL nhúng.
- **Trình duyệt**: Google Chrome, Microsoft Edge, Brave hoặc Firefox phiên bản hiện đại.

### 2.2. Biến môi trường cấu hình (.env)
Tạo file `.env` tại thư mục gốc của dự án (hoặc kiểm tra file `.env.example`):

```bash
# Model AI cấu hình qua OpenCode Go Provider
OPENCODE_API_KEY="your-opencode-api-key"
OPENCODE_MODEL="minimax-m3"

# Tuỳ chọn ghi đè Model Pi (ưu tiên cao nhất nếu được thiết lập)
PI_MODEL="minimax-m3"
PI_PROVIDER="opencode-go"
PI_THINKING_LEVEL="off"

# Cổng mạng dịch vụ
API_PORT=3001
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 2.3. Lệnh khởi động hệ thống
Mở terminal tại thư mục gốc của repository và thực thi:

```bash
# Cài đặt toàn bộ dependencies trong monorepo
bun install

# Khởi chạy đồng thời cả Backend API (port 3001) và Web Dashboard (port 3000)
bun run dev
```

Quy trình khởi động của Backend (`apps/api`) sẽ thực hiện tuần tự 9 bước an toàn:
1. Xác thực biến môi trường (`config/env.ts`).
2. Khởi tạo Singleton cơ sở dữ liệu nhúng PGlite.
3. Kết nối Drizzle ORM.
4. Chạy tự động migrations Drizzle (`0000`, `0001`, `0002`).
5. Khởi tạo hàng đợi `pg-boss` nhúng.
6. Thiết lập 5 hàng đợi tác vụ (`demo-ping`, `extractor`, `planner`, `writer`, `reviewer`).
7. Đăng ký các worker xử lý nền.
8. Khởi tạo Model Runtime cho Pi SDK.
9. Mở cổng lắng nghe HTTP tại `http://localhost:3001`.

Frontend Next.js sẽ sẵn sàng phục vụ tại `http://localhost:3000`.

### 2.4. Kiểm tra sức khỏe dịch vụ (Health Check)
Bạn có thể xác minh trạng thái của toàn bộ hệ thống bằng lệnh:

```bash
curl http://localhost:3001/health
```

Kết quả phản hồi chuẩn:
```json
{
  "status": "ok",
  "services": {
    "api": true,
    "database": true,
    "queue": true,
    "pi": true
  }
}
```

---

## 3. TỔNG QUAN GIAO DIỆN NGƯỜI DÙNG (UI WALKTHROUGH)

Truy cập trình duyệt tại địa chỉ: `http://localhost:3000`. Giao diện được thiết kế theo chuẩn **Split View 2 cột hiện đại**:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ✨ Sử Ký Agent Studio                                            Status: Ready      │
├───────────────────────────────────────────────┬──────────────────────────────────────┤
│ [CỘT TRÁI - 60% CHIỀU RỘNG]                   │ [CỘT PHẢI - 40% CHIỀU RỘNG (STICKY)] │
│                                               │                                      │
│ 1. Khung nhập liệu sản phẩm thô               │ ┌──────────────────────────────────┐ │
│    [Textarea nhập liệu (có sẵn dữ liệu mẫu)]  │ │ [Bản xem trước] [Trace] [JSON]   │ │
│    [Nút: Bắt đầu workflow]                    │ └──────────────────────────────────┘ │
│                                               │                                      │
│ 2. Tiến trình thực thi 4 bước (Stepper)       │ [NỘI DUNG TAB HIỆN TẠI]              │
│    • Bước 1: Trích xuất dữ kiện (Extractor)   │  • Tab 1: Live Ad Preview Card       │
│    • Bước 2: Kế hoạch nội dung (Planner)      │    (Tiêu đề, Body, CTA, Nút Copy)    │
│      └─ [Action Deck: Review Gate 1]          │  • Tab 2: Nhật ký Trace SSE          │
│    • Bước 3: Soạn bài quảng cáo (Writer)      │    (Dòng log sự kiện real-time)      │
│      └─ [Action Deck: Review Gate 2]          │  • Tab 3: Raw JSON Inspector         │
│    • Bước 4: Kiểm chứng sự thật (Reviewer)    │    (Cấu trúc JSON chi tiết)          │
└───────────────────────────────────────────────┴──────────────────────────────────────┘
```

### 3.1. Bố cục Split View 2 cột
- **Cột trái (Scrollable)**: Trung tâm điều khiển. Chứa khung nhập liệu và danh sách thẻ đại diện cho 4 bước trong quy trình. Khi có bước cần duyệt, thẻ điều khiển sẽ mở rộng ngay tại vị trí bước đó.
- **Cột phải (Sticky)**: Khu vực giám sát và kết quả. Luôn cố định trên màn hình ngay cả khi người dùng cuộn xem lịch sử làm việc của các bước bên trái.

### 3.2. Cột trái: Khối nhập liệu & Stepper 4 bước
Mỗi thẻ bước (Step Card) cung cấp:
- **Biểu tượng & Trạng thái**: `Chờ chạy` (Xám), `Đang chạy` (Xanh xoay vòng), `Chờ bạn duyệt` (Vàng hổ phách), `Hoàn tất` (Xanh ngọc lụa), `Cũ (cần chạy lại)` (Đỏ nhạt cảnh báo).
- **Version Switcher**: Khi một bước có từ 2 phiên bản trở lên (sau khi Rerun hoặc Edit), hệ thống hiển thị hàng nút tab `v1`, `v2`,... cho phép lật qua lật lại giữa các phương án.
- **Incoming Guidance Banner**: Nếu bước hiện tại nhận được lời dặn từ bước trước, banner thông báo màu xanh ngọc sẽ xuất hiện ở đầu thẻ.
- **Nút "Xem JSON chi tiết"**: Cho phép mở/đóng xem toàn bộ dữ liệu có cấu trúc mà Agent đã sinh ra.

### 3.3. Cột phải: Bảng điều khiển đa năng
- **Tab 1: Bản xem trước (Live Ad Preview)**: Render trực quan bài viết quảng cáo với đầy đủ Header phân loại đối tượng, Headline in đậm thu hút, Body phân đoạn dễ đọc và nút CTA nổi bật. Có nút **"📋 Sao chép"** (1-click copy) để dán ngay vào chiến dịch tiếp thị.
- **Tab 2: Nhật ký Trace (Trace Panel)**: Kết nối kênh Server-Sent Events (SSE), hiển thị nhật ký thời gian thực theo từng mili-giây: thời điểm tạo job, nội dung prompt gửi vào Pi SDK, thời gian phản hồi, độ dài ký tự và trạng thái hoàn thành.
- **Tab 3: Raw JSON**: Dành cho nhà phát triển muốn theo dõi trạng thái toàn cục của đối tượng `WorkflowRun` (chứa toàn bộ `steps`, `versions`, `inputJson`, `outputJson`).

### 3.4. Bảng điều khiển can thiệp (Action Deck)
Khi bước dừng ở trạng thái `WAITING_FOR_HUMAN`, Action Deck xuất hiện với 3 vùng chức năng rõ ràng:

1. **Khối Màu Vàng (Amber) — Yêu cầu Agent làm lại (Rerun)**:
   - Ô nhập: "Nhập yêu cầu sửa đổi..."
   - Quick Action Chips: Các thẻ bấm nhanh nội dung góp ý thường gặp.
   - Nút: **"Gửi phản hồi & Sửa lại"**.
2. **Khối Màu Xanh (Emerald) — Duyệt & Chuyển bước (Continue)**:
   - Ô nhập: "Lời dặn cho bước tiếp theo (tùy chọn)..."
   - Quick Action Chips: Các câu dặn dò định hướng cho bước tiếp theo.
   - Nút: **"Duyệt & Đi tiếp →"**.
3. **Nút "✏️ Sửa trực tiếp"**: Chuyển đổi khung làm việc sang trình biên tập JSON trực tiếp, cho phép can thiệp thủ công dữ liệu mà không cần gọi lại LLM.

---

## 4. HƯỚNG DẪN THAO TÁC TỪNG BƯỚC (STEP-BY-STEP TASK GUIDES)

### 4.1. Khởi tạo một quy trình tạo quảng cáo mới
1. Mở trang web `http://localhost:3000`.
2. Tại ô **"Thông tin sản phẩm đầu vào"**, nhập văn bản mô tả sản phẩm của bạn (hoặc sử dụng văn bản mẫu có sẵn).
   *Ví dụ:*
   ```text
   Bình giữ nhiệt 750ml.
   Giữ lạnh 18 giờ, giữ nóng 10 giờ.
   Vỏ inox. Giá 299.000đ.
   Đối tượng là sinh viên và dân văn phòng.
   ```
3. Nhấp nút **"Bắt đầu workflow"**.
4. **Quan sát**:
   - Hệ thống sẽ kích hoạt Agent 1 (`EXTRACTOR`) để phân tích và bóc tách các trường: `capacityMl`, `coldHours`, `hotHours`, `material`, `price`, `audiences`.
   - Ngay sau đó, Agent 2 (`PLANNER`) sẽ tự động được kích hoạt để đề xuất kế hoạch nội dung.

---

### 4.2. Thao tác tại Cổng duyệt 1: Kế hoạch nội dung (Planner)
Khi Planner hoàn tất, thẻ bước 2 chuyển sang trạng thái **"Chờ bạn duyệt"** và hiển thị Action Deck:

![Planner Review Gate](https://placeholder.local/planner-gate.png)

Bạn có các lựa chọn sau:

#### Phương án A: Duyệt và bổ sung lời dặn cho bước Viết (Khuyến nghị)
1. Kiểm tra đối tượng mục tiêu, tone giọng, góc tiếp cận và luận điểm then chốt mà Planner đề xuất.
2. Tại ô **"Lời dặn cho bước tiếp theo"**, nhập định hướng mà bạn muốn Agent Viết tuân theo (hoặc chọn 1 chip gợi ý, ví dụ: *"Dùng tone hài hước nhẹ"*).
3. Nhấp **"Duyệt & Đi tiếp →"**.
4. **Kết quả**: Bước Planner được chốt bản `v1`. Bước Writer bắt đầu chạy và nhận được lời dặn này.

#### Phương án B: Yêu cầu AI lập lại kế hoạch (Rerun)
1. Nếu bạn không đồng ý với góc tiếp cận của AI, hãy nhập lý do vào ô **"Nhập yêu cầu sửa đổi..."** (Ví dụ: *"Đổi góc tiếp cận sang bảo vệ môi trường, hạn chế rác thải nhựa"*).
2. Nhấp **"Gửi phản hồi & Sửa lại"**.
3. **Kết quả**: Planner sẽ sinh ra bản kế hoạch `v2`. Bạn có thể dùng tab `v1` / `v2` để so sánh và quyết định duyệt bản nào.

---

### 4.3. Sử dụng Quick Action Chips để ra lệnh nhanh
Hệ thống tích hợp sẵn các thẻ bấm nhanh ngữ cảnh (Quick Action Chips), giúp bạn không cần tốn thời gian gõ bàn phím:

- **Khi yêu cầu Planner làm lại**:
  - `[Tập trung vào dân văn phòng]`
  - `[Nhấn mạnh bảo hành và độ bền]`
  - `[Đổi tone sang tối giản]`
  - `[Tăng tính cấp bách]`
  - `[Tạo góc nhìn độc lạ]`
- **Khi dặn dò Writer viết bài**:
  - `[Viết bài ngắn dưới 100 từ]`
  - `[Dùng tone hài hước nhẹ]`
  - `[Nhấn mạnh tiêu chuẩn chất lượng]`
  - `[Tránh dùng emoji]`
- **Khi yêu cầu Writer viết lại**:
  - `[Ngắn gọn hơn nữa]`
  - `[Headline giật gân hơn]`
  - `[Đổi CTA kêu gọi mua ngay]`
  - `[Nhấn mạnh giá và khuyến mãi]`
  - `[Văn phong tinh tế hơn]`
- **Khi dặn dò Reviewer kiểm chứng**:
  - `[Soi kỹ thông số kỹ thuật]`
  - `[Kiểm tra kỹ các cam kết]`
  - `[Đảm bảo không bị cường điệu]`

*Chỉ cần nhấp chuột vào một chip, nội dung sẽ được điền ngay lập tức vào ô tương ứng.*

---

### 4.4. Chỉnh sửa trực tiếp (In-Place Edit) không tốn token LLM
Khi bạn chỉ muốn sửa nhanh một từ ngữ hoặc số liệu mà không muốn chờ đợi AI sinh lại:

1. Nhấp nút **"✏️ Sửa trực tiếp"** tại Action Deck của bước hiện tại.
2. Khung soạn thảo JSON trực quan sẽ xuất hiện với dữ liệu hiện tại của bước.
3. Chỉnh sửa nội dung mong muốn trực tiếp trong ô văn bản.
4. Nhấp nút **"Lưu & Tiếp tục →"**.
5. **Kết quả**: Một phiên bản mới do người dùng biên tập được ghi vào cơ sở dữ liệu (`humanFeedback = "Direct in-place edit by user"`), được phê duyệt ngay lập tức và quy trình tự động chuyển sang bước tiếp theo mà không tiêu tốn thêm thời gian gọi LLM.
6. Nếu muốn quay lại, chỉ cần bấm **"Hủy"** hoặc **"Đóng chỉnh sửa"**.

---

### 4.5. Thao tác tại Cổng duyệt 2: Soạn thảo quảng cáo (Writer)
Sau khi Writer xử lý xong bản thảo, bước 3 sẽ dừng ở trạng thái **"Chờ bạn duyệt"**:

1. Quan sát đồng thời cả 2 bên:
   - **Bên trái**: Thẻ bước 3 hiển thị chi tiết Tiêu đề, Nội dung phân đoạn và Kêu gọi hành động (CTA).
   - **Bên phải**: Tab **"Bản xem trước"** hiển thị bài viết hoàn chỉnh như khi đăng tải thực tế.
2. Nếu bài viết đã ưng ý:
   - Nhập lời dặn kiểm chứng cho Reviewer (ví dụ: *"Kiểm tra kỹ các cam kết"*).
   - Nhấp **"Duyệt & Đi tiếp →"**.
3. Nếu bài viết chưa ưng ý: Sử dụng tính năng Rerun hoặc Direct Edit như hướng dẫn ở mục 4.6.

---

### 4.6. Yêu cầu viết lại (Rerun) & So sánh giữa các phiên bản (Version Switcher)
1. Tại Khối màu vàng của bước Writer, nhấp chọn chip **`[Headline giật gân hơn]`**.
2. Nhấp **"Gửi phản hồi & Sửa lại"**.
3. Writer sẽ tiến hành viết lại bản `v2` với tiêu đề cuốn hút hơn (Ví dụ: *"KHÁT CẢ NGÀY CŨNG KHÔNG NGÁN!..."*).
4. Quan sát thẻ bước 3 xuất hiện hàng nút:
   ```
   Phiên bản: [ v2 ]  [ v1 ]
   ```
5. Nhấp vào tab `v1` để xem lại bản thảo ban đầu. Bản xem trước bên phải sẽ giữ đồng bộ và cập nhật theo phiên bản bạn đang chọn.
6. Khi chọn được phiên bản ưng ý nhất, tiến hành nhấp **"Duyệt & Đi tiếp →"**.

---

### 4.7. Kiểm tra kết quả thẩm định sự thật (Reviewer) & Sao chép bài viết
Khi bước 4 (`REVIEWER`) hoàn tất:

1. Thẻ Reviewer hiển thị huy hiệu:
   - `✓ ĐẠT — Đúng sự thật`: Toàn bộ nội dung quảng cáo hoàn toàn khớp với dữ kiện kỹ thuật gốc, không có yếu tố phóng đại sai sự thật.
   - `⚠️ KHÔNG ĐẠT`: Kèm danh sách các điểm nghi vấn/mâu thuẫn (`issues`) nếu bài viết có dấu hiệu bịa đặt thông số.
2. Tại cột bên phải, nhấp nút **"📋 Sao chép"** trên đầu Live Ad Preview Card.
3. Thông báo đổi thành `✓ Đã sao chép`. Toàn bộ bài viết (Tiêu đề, Nội dung, Lời kêu gọi hành động) đã sẵn sàng trong clipboard của bạn.

---

## 5. CƠ CHẾ CHUYÊN SÂU & NGUYÊN LÝ HOẠT ĐỘNG (DEEP-DIVE)

### 5.1. Phân biệt Lời dặn bước tiếp (Guidance) vs Góp ý sửa lại (Feedback)
Hệ thống phân định rạch ròi giữa 2 luồng chỉ dẫn của con người:

| Khái niệm | Vị trí thao tác | Bản chất kỹ thuật | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| **Revision Feedback** (`humanFeedback`) | Khối Vàng (Rerun) | Được lưu vào bản `step_versions` mới của bước hiện tại | Chỉ đạo chính Agent đó tự sửa lỗi và tối ưu hoá lại bài làm của mình. |
| **Forward Guidance** (`incomingGuidance`) | Khối Xanh (Continue) | Được ghi vào cột `incoming_guidance` của bảng `workflow_steps` của bước kế tiếp | Định hướng hành vi cho Agent tiếp theo mà không làm xáo trộn kết quả của bước hiện tại. |

### 5.2. Cơ chế vô hiệu hóa hạ nguồn (Downstream Invalidation & Trạng thái STALE)
Trong một quy trình nhiều bước, nếu một bước thượng nguồn (Upstream) bị chạy lại sau khi các bước hạ nguồn (Downstream) đã từng chạy xong, tính nhất quán của dữ liệu sẽ bị đe dọa.

Sử Ký Studio giải quyết triệt để vấn đề này:
- Khi người dùng bấm **Rerun tại Planner**, toàn bộ các bước hạ nguồn (`WRITER`, `REVIEWER`) lập tức được chuyển sang trạng thái `STALE`.
- Thẻ của các bước này sẽ chuyển sang viền nét đứt màu đỏ nhạt với huy hiệu: `Cũ (cần chạy lại)`.
- Nhờ đó, người dùng không bao giờ nhầm lẫn giữa kết quả của phiên bản cũ và dữ liệu mới.

### 5.3. Khóa lạc quan chống Race Condition & Double-Click
Để đảm bảo an toàn tuyệt đối trên cơ sở dữ liệu nhúng PGlite (chạy đơn tiến trình WASM), hệ thống áp dụng cơ chế chuyển dịch trạng thái nguyên tử (Atomic Conditional Status Transition):

```sql
UPDATE workflow_steps
SET status = 'RUNNING', ...
WHERE workflow_run_id = $1 
  AND step_type = $2 
  AND status = 'WAITING_FOR_HUMAN' 
  AND current_version = $3
RETURNING *;
```

Nếu người dùng vô tình bấm đúp chuột (double-click) hoặc gửi đồng thời 2 yêu cầu, câu lệnh cập nhật đầu tiên sẽ thành công; câu lệnh thứ hai tìm thấy trạng thái không còn là `WAITING_FOR_HUMAN` nữa nên sẽ trả về 0 dòng và API lập tức ném lỗi `409 Conflict: "Step is not in WAITING_FOR_HUMAN status"`. Hệ thống hoàn toàn miễn nhiễm với hiện tượng duplicate job.

---

## 6. GIÁM SÁT & NHẬT KÝ VẬN HÀNH (OBSERVABILITY)

### 6.1. Theo dõi dòng sự kiện thời gian thực (SSE Stream)
Chuyển sang tab **"Nhật ký Trace"** ở cột bên phải để theo dõi luồng sự kiện được gửi từ endpoint `GET /events/stream`:
- Sự kiện hệ thống: `workflow.created`, `step.approved`, `step.rerun`.
- Sự kiện Pi SDK:
  - `pi.<agent>.turn.started`: Bắt đầu một lượt suy luận của AI.
  - `pi.<agent>.message.ended`: Mô hình đã trả về câu trả lời hoàn chỉnh kèm độ dài ký tự.
  - `pi.<agent>.turn.ended`: Kết thúc phiên làm việc an toàn, dọn dẹp tài nguyên.

Bạn có thể lọc nhật ký với các nút:
- **Gọn gàng**: Chỉ xem các sự kiện then chốt của tác tử.
- **Toàn bộ**: Xem mọi vết ghi chi tiết.
- **Làm mới**: Đồng bộ lại toàn bộ danh sách sự kiện từ database.

### 6.2. Kiểm tra Raw JSON trạng thái
Chuyển sang tab **"JSON"** để xem toàn bộ cấu trúc dữ liệu phẳng của quy trình. Đây là công cụ hữu ích cho kỹ sư kiểm thử muốn đối chiếu trực tiếp cấu trúc của `inputJson` và `outputJson` đã được xác thực bởi Zod Schema.

---

## 7. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 7.1. Lỗi kiểm tra điểm phục hồi PGlite (WASM Checkpoint / Panic)
- **Hiện tượng**: Khởi động API thất bại ở bước [4/9] với thông báo: `RuntimeError: Aborted() ... PANIC: could not locate a valid checkpoint record`.
- **Nguyên nhân**: Tiến trình terminal bị đóng đột ngột (tắt ngang máy tính hoặc ngắt terminal bằng Force Kill) trong lúc PGlite đang ghi dữ liệu WAL vào đĩa.
- **Cách khắc phục**:
  Chạy lệnh dọn dẹp cơ sở dữ liệu nhúng:
  ```bash
  bun run db:clean
  ```
  Sau đó khởi động lại với `bun run dev`. PGlite sẽ tự động tạo mới thư mục dữ liệu sạch và chạy lại toàn bộ migrations.

### 7.2. Lỗi kết nối AI Provider / Model Timeout
- **Hiện tượng**: Bước chạy kéo dài quá 60 giây và chuyển sang trạng thái `FAILED`.
- **Nguyên nhân**: Kết nối Internet gián đoạn hoặc API Key của OpenCode Go hết hạn ngạch / bị nghẽn mạng.
- **Cách khắc phục**:
  1. Kiểm tra lại `OPENCODE_API_KEY` trong file `.env`.
  2. Kiểm tra trạng thái sẵn sàng của Pi qua lệnh:
     ```bash
     curl -X POST http://localhost:3001/pi/test
     ```
     Nếu phản hồi `{"status":"ok","reply":"PONG"}` nghĩa là kết nối AI bình thường.

### 7.3. Nút bấm bị vô hiệu hóa hoặc không phản hồi
- **Hiện tượng**: Nút "Gửi phản hồi & Sửa lại" bị mờ và không bấm được.
- **Nguyên nhân**: Ô nhập liệu góp ý đang bị bỏ trống. Hệ thống quy định bắt buộc phải có nội dung góp ý mới cho phép thực hiện Rerun.
- **Cách khắc phục**: Nhập ít nhất 1 ký tự vào ô hoặc nhấp vào bất kỳ một Quick Action Chip nào bên dưới ô nhập liệu.

---

## 8. CÂU HỎI THƯỜNG GẶP & THỰC HÀNH TỐT NHẤT (FAQ & BEST PRACTICES)

**Q1: Làm sao để AI viết được bài quảng cáo đúng ý tôi nhất ngay từ lần đầu?**  
*Trả lời*: Hãy cung cấp thông tin sản phẩm đầu vào càng rõ ràng càng tốt (đặc biệt là giá bán, công năng độc đáo nhất và đối tượng muốn nhắm tới). Tại Cổng duyệt 1 (Planner), hãy tận dụng ô **"Lời dặn cho bước tiếp theo"** để dặn dò phong cách cụ thể (ví dụ: *"Viết ngắn, súc tích, nhắm vào tâm lý tiết kiệm"*).

**Q2: Việc bấm "Sửa trực tiếp" khác gì với việc yêu cầu AI "Sửa lại"?**  
*Trả lời*:
- Bấm **"Sửa lại" (Rerun)** sẽ gọi lại mô hình AI, tiêu tốn token và mất khoảng 5–15 giây để sinh văn bản mới.
- Bấm **"Sửa trực tiếp" (Direct Edit)** diễn ra tức thì, không tiêu tốn token của LLM, phù hợp khi bạn chỉ cần sửa đổi những chi tiết nhỏ (ví dụ: sửa lại số điện thoại hotline, đổi từ ngữ địa phương, cắt ngắn 1 câu).

**Q3: Dữ liệu bài viết có bị lưu lên đám mây không?**  
*Trả lời*: **Hoàn toàn không**. Hệ thống là Local-First 100%. Mọi dữ liệu sản phẩm, kế hoạch và bài viết được lưu trữ ngay trên máy tính của bạn tại thư mục `./packages/db/data/pgdata`.

---

## 9. THUẬT NGỮ CHUYÊN NGÀNH (GLOSSARY)

| Thuật ngữ | Định nghĩa trong hệ thống Sử Ký Agent Studio |
| :--- | :--- |
| **Agent (Tác tử)** | Một thực thể AI chuyên biệt hóa với mục tiêu hẹp (Extractor, Planner, Writer, Reviewer). |
| **HITL (Human-in-the-Loop)** | Cơ chế giữ con người ở trung tâm quyền quyết định trước khi hệ thống chuyển giao kết quả sang giai đoạn tiếp theo. |
| **Review Gate (Cổng duyệt)** | Điểm dừng chiến lược trong quy trình làm việc, nơi trạng thái chuyển thành `WAITING_FOR_HUMAN` để đợi chỉ thị từ người dùng. |
| **Forward Guidance** | Lời dặn dò, định hướng gửi tới bước tiếp theo trong quy trình. |
| **Revision Feedback** | Ý kiến phản hồi dùng để yêu cầu chính bước hiện tại làm lại (Rerun). |
| **STALE** | Trạng thái của một bước hạ nguồn đã trở nên lỗi thời do bước thượng nguồn vừa bị chỉnh sửa/chạy lại. |
| **PGlite** | Bản phân phối PostgreSQL chính thức được biên dịch thành WebAssembly (WASM), chạy nhúng trực tiếp trong Node/Bun. |
| **pg-boss** | Thư viện quản lý hàng đợi tác vụ trên nền PostgreSQL, hỗ trợ cơ chế retry và xử lý công việc bất đồng bộ. |
| **Split View** | Thiết kế giao diện chia đôi màn hình: bên trái điều khiển quy trình, bên phải xem kết quả và giám sát thời gian thực. |

---
*Tài liệu được biên soạn và kiểm chứng thực nghiệm tự động bởi Agent Browser trên môi trường Sử Ký Studio v1.2.0.*
