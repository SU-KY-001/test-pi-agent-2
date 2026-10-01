---
title: "Flow 2 — Execution Tree, Checkpoint Branching và Pi Web Access"
description: "Nghiên cứu kiến trúc có sẵn cho lịch sử thực thi bất biến, mở nhánh từ phiên bản cũ và agent nghiên cứu web; cập nhật yêu cầu sau review."
status: decided
created: 2026-10-02
researched_at: "2026-10-02T01:33:03+07:00"
decided_at: "2026-10-02T02:00:00+07:00"
tags: [flow-2, execution-tree, adjacency-list, drizzle-orm, pglite, pi-web-access]
---

# Flow 2 — Execution Tree, Checkpoint Branching và Pi Web Access

## 1. Executive summary

**QUYẾT ĐỊNH KIẾN TRÚC CUỐI CÙNG (User Approved):** Bác bỏ hoàn toàn việc đưa LangGraph vào dự án nhằm tránh bloated dependencies, xung đột version giữa LangGraph `1.4.18` và saver PGlite cộng đồng `0.0.6` vốn đã lỗi thời. Thay vào đó, áp dụng mô hình **Cây Lịch sử Thực thi Bản địa (Native Execution Tree / Adjacency List)** trực tiếp trên nền tảng **Drizzle ORM + PGlite singleton** có sẵn. Đây thuần túy là bài toán Cấu trúc Dữ liệu & Thiết kế CSDL kinh điển (Commit Graph kiểu Git), giữ trọn vẹn stack tối giản: Bun + Hono + Drizzle + PGlite + pg-boss + Pi SDK.

**Đánh giá framework trước đó (Lưu trữ tham khảo):** LangGraph.js có sẵn checkpoint history, `parentConfig` và time travel, nhưng việc tích hợp adapter PGlite gặp nhiều rủi ro kỹ thuật (saver cộng đồng không nhận singleton PGlite hiện hữu, dùng interface cũ). Do đó giải pháp thiết kế Native Adjacency List trên Drizzle là phương án tối ưu, trực tiếp và an toàn nhất.

## 2. Phạm vi và phương pháp

- Câu hỏi: lưu mọi lần chạy, quay về phiên bản cũ và mở rộng một nhánh mới; upstream và downstream phải thuộc cùng lineage; approvals không lẫn nhánh.
- Ràng buộc: Bun, API là runtime owner, PGlite singleton, không Docker/Redis/PG server; Pi SDK hiện dùng ephemeral sessions; không viết test suite trong đợt này.
- Tra cứu: 5 lượt search/fetch, ưu tiên tài liệu chính thức, npm manifest và source pinned theo commit. Truy xuất lại nội dung đã thu thập để xác minh chi tiết, không dựa vào code do search provider sinh.
- Gemini CLI preflight thất bại vì cwd chưa được trust; không thay đổi trust, chuyển sang web tools.
- Docs-seeker scripts không tìm được tài liệu trên Context7; chuyển sang tài liệu chính thức.
- Đọc code demo, local SDK declarations và source extension đang cài. Không chạy probe tích hợp, không benchmark. Tuyên bố runtime compatibility được đánh dấu chưa xác minh.
- Nguồn gồm tài liệu hiện hành, package metadata hiện tại và saver cộng đồng ở commit cố định; không suy ra mức trưởng thành chỉ từ tên package hoặc README.

## 3. Yêu cầu đã được người dùng làm rõ

| Chủ đề | Quyết định đưa vào bản plan sửa |
|---|---|
| Trọng tâm kể | Mục tiêu chính là sinh các hướng kể cụ thể kèm tiêu đề mẫu. Các loại như diễn biến, nhân vật, nguyên nhân, giải thích là nhóm phân loại; không ép đúng 5 option, không tự tạo loại chiến thuật bắt buộc. Chưa chốt đầy đủ danh sách category thứ năm. |
| Chọn hướng | Đưa lựa chọn trọng tâm ngay đầu flow, trước bóc tách facts và dựng dàn ý. |
| Tìm nguồn | Agent dùng extension `npm:pi-web-access`, không chỉ mô tả việc tìm nguồn trong prompt. |
| Kiểm chứng chéo | Là phương pháp nghiên cứu: chủ động tìm ghi chép từ các phía/quốc gia và các nguồn độc lập; không phải một feature ma trận/điểm số riêng. Chỉ có một phía thì ghi rõ giới hạn, không bịa phía còn lại. |
| Kiểm định/xuất bản | Tách đã chạy xong kiểm định khỏi đủ điều kiện xuất bản. |
| Lịch sử | Giữ mọi lần chạy và thay đổi; quay lại bất kỳ node cũ hợp lệ để continue/fork. Không ghi đè hoặc xóa các nhánh cũ. |
| Legacy | Có thể reset DB quảng cáo demo khi chuyển schema, sau khi dừng runtime; không áp dụng chính sách reset cho lịch sử Flow 2 mới. |
| Văn phong và sử liệu | Bản v2-1 là tham khảo văn phong, không tự động chứng minh các chi tiết lịch sử; regex không quyết định ngữ pháp. |
| QA | Hoãn test cases/suites. Giữ typecheck/build và kiểm tra thủ công khi implement; không tự thêm một phase viết test suite. |

## 4. Phân biệt ba cấu trúc

1. **Workflow definition:** bảy loại agent và thứ tự chạy. Một graph có thể chứa bảy node, dù đã thực thi hàng trăm lần.
2. **Execution/checkpoint tree:** lịch sử các trạng thái/lần chạy cụ thể. Cùng một loại agent có nhiều node lịch sử vì rerun/fork.
3. **Pi session tree:** messages, tool calls, context edits của một cuộc hội thoại. Không đồng nhất với cây nghiệp vụ của bảy agent.

Không dùng `currentVersion` trên từng loại bước để ghép bảy đầu ra mới nhất: chúng có thể đến từ các nhánh không liên quan. Không dùng danh sách checkpoint theo thời gian làm active branch; phải đi theo parent links của checkpoint được chọn.

### Ví dụ đúng với nhu cầu

```text
Chủ đề / workflow container
└── S1 tư vấn nguồn và hướng kể
    └── Chọn hướng A
        └── S2 thẩm định nguồn
            └── S3 facts
                ├── S4 dàn ý — lần 1
                │   └── S5 → S6 → S7 — nhánh A
                ├── S4 dàn ý — lần 2
                │   ├── S5 → S6 → S7 — nhánh B cũ
                │   └── S5 chạy mới → S6 → S7 — nhánh B mở rộng
                └── S4 dàn ý — lần 3, 4, 5 ...
```

Lần 2 vẫn nguyên vẹn dù đã chạy đến lần 5. Chọn lần 2 để xem không gọi LLM. Tiếp tục từ lần 2 tạo hậu duệ mới, không lấy facts/approval từ nhánh lần 5.

**Root/leaf:** root hiển thị có thể là S1 nếu S1 cố định. Nếu S1 cũng được rerun, cần container/chủ đề làm gốc kỹ thuật để giữ nhiều S1 siblings; UI vẫn mở đầu ở Step 1. Leaf là node hiện chưa có con, có thể dừng ở bước trung gian; leaf ở S7 mới là nhánh đã đi đến bước cuối. Gate và chỉnh sửa tạo checkpoint phụ nên độ sâu cây không nhất thiết bằng số bước.

## 5. So sánh giải pháp có sẵn

| Giải pháp | Khả năng đã có | Điểm không khớp | Kết luận |
|---|---|---|---|
| LangGraph.js + checkpointer | History, parent lineage, replay/fork, interrupts, pending writes, durability modes | Cần adapter PGlite phù hợp phiên bản, UI cây và approvals nghiệp vụ; không tự giải quyết exactly-once tool calls | Phù hợp nhất nếu muốn tái sử dụng engine dựng sẵn. |
| Pi SessionManager | JSONL tree `id/parentId`, active leaf, context theo branch; không xóa nhánh bỏ lại | Cây hội thoại, không có sẵn orchestration bảy agent, PGlite transaction, approve/publish theo artifact | Giữ cho transcript; không chọn làm sole workflow engine. |
| Temporal reset | Event history, reset tới event hợp lệ, tạo run mới và copy lịch sử prefix | Có Temporal Service; reset thiên về phục hồi, không phải UI biên tập cây; không hợp zero-daemon hiện tại | Không chọn cho demo này. |
| Checkpoint tree trên Drizzle/pg-boss | Có thể tái sử dụng stack và parent links, không thêm graph runtime | Các semantics fork/resume, delivery và concurrency do dự án tự viết | Fallback đơn giản hơn về dependency, nhưng không phải package dựng sẵn. |

### 5.1. LangGraph đã dựng phần nào?

Tài liệu chính thức mô tả:
- Checkpoint được lưu sau mỗi **super-step**, không phải sau từng token/tool call. Pipeline tuần tự cho checkpoint boundary sau mỗi agent. [S2]
- `StateSnapshot` có `values`, `next`, `config`, `metadata`, `parentConfig`, `tasks`. [S2]
- `getStateHistory` trả history; `getState` đọc checkpoint cụ thể. [S2]
- `updateState` tạo checkpoint mới, không sửa checkpoint gốc. Reducer có thể accumulate; phải thiết kế channels để sửa output không vô tình nối thêm dữ liệu cũ. [S1–S2]
- Replay/fork giữ kết quả trước checkpoint; các bước sau checkpoint chạy lại, gồm LLM/API calls và interrupts. Không có bảo đảm kết quả replay giống hệt. [S1]
- `durability: "sync"` ghi checkpoint trước khi chạy bước kế tiếp; phù hợp ưu tiên giữ lịch sử, nhưng không biến external calls thành exactly-once. [S2]
- `put`, `putWrites`, `getTuple`, `list` là core saver methods tài liệu nêu. Khi triển khai phải theo exported interface của phiên bản pin, không coi danh sách docs là toàn bộ contract mọi phiên bản. [S2]

**Không cần LangSmith cloud** để dùng LangGraph core. Agent node chỉ cần gọi wrapper Pi SDK và trả structured output theo Zod.

### 5.2. Vì sao chưa khuyến nghị cài saver PGlite tìm được?

Đã đọc manifest và source tại commit `c71cec49282ffd9e09e2791b3364392a9bdde854`:

| Thuộc tính | Bằng chứng |
|---|---|
| Saver cộng đồng | `@steerprotocol/langgraph-checkpoint-pglite@0.0.6` |
| Peer checkpoint | `~0.0.13` |
| Peer LangChain core | `>=0.2.31 <0.4.0` |
| LangGraph registry hiện trả về | `@langchain/langgraph@1.4.18`, dependency checkpoint `^1.1.5`, peer core `^1.1.48` |
| Tạo DB | `constructor(dbPath: string, serde?: SerializerProtocol)` gọi `this.db = new PGlite(dbPath)` |
| DB đóng | `end()` gọi `this.db.close()`; adapter dùng chung singleton phải để API quản lý lifecycle |
| Transaction | Dùng `BEGIN/COMMIT` bằng `db.query`; chưa xác minh isolation trong môi trường chia sẻ Drizzle/pg-boss |
| Trạng thái setup | `isSetup = true` trong `finally`, kể cả lỗi; cần xem lại nếu kế thừa source |

Đây là các vướng mắc nhìn thấy trong source, không phải kết luận từ benchmark hoặc probe. Package tự khai hỗ trợ Bun trong README; điều đó không chứng minh tương thích LangGraph hiện hành và singleton DB của repo.

Không hạ toàn bộ stack về API cũ chỉ để dùng một saver chưa xác minh. Có thể tham khảo source MIT để làm adapter tương thích, nhưng phải rà license/attribution nếu copy và coi adapter là hạng mục implementation thật.

## 6. Kiến trúc đề xuất nếu chọn LangGraph

```text
Next.js dashboard — xem cây, chọn node, approve, fork, continue
        ↓ HTTP / Zod
Hono API — workflow/branch identity, approvals, publication policy
        ↓ durable command delivery
pg-boss — chạy một lần advance tới gate tiếp theo hoặc kết thúc
        ↓
LangGraph.js — sở hữu thứ tự agent, checkpoint, interrupt/resume
        ↓                            ↓
Pi SDK ephemeral session             Checkpointer adapter
+ pi-web-access ở các role cần nguồn  nhận PGlite singleton của API
        ↓                            ↓
Structured output + nguồn đã đọc     PGlite: checkpoints + artifacts + decisions
```

**Một engine quyết định chuyển bước.** Nếu chọn LangGraph, bảy worker pg-boss không còn độc lập sở hữu cùng state machine. Pg-boss chỉ delivery/lập lịch invocation; LangGraph quyết định node kế tiếp và điểm dừng. Nếu chọn phương án nội bộ, pg-boss/state machine hiện tại giữ vai trò đó. Không ghép hai orchestrators cùng enqueue bảy bước.

### Flow nghiệp vụ đã điều chỉnh

```text
Topic
→ S1 Researcher: tìm nguồn sơ bộ, liệt kê hướng kể + tiêu đề mẫu
→ Gate A: chọn hướng kể/title/scale và định hướng nguồn
→ S2 Source Evaluator: đọc nguồn, đánh giá độ phù hợp và tìm thêm các phía
→ S3 Fact Extractor: facts, đoạn trích, các điểm chưa đủ chứng cứ
→ S4 Story Planner: dàn ý theo hướng đã chọn
→ Gate B: duyệt dàn ý
→ S5 Script Writer
→ S6 Oralizer
→ S7 Fact Checker
→ Gate C: duyệt đúng bản đủ điều kiện xuất bản
```

S1 cần đủ tìm hiểu sơ bộ để title không thành hứa hẹn vô căn cứ. S2 có thể bổ sung nguồn sau khi chọn hướng. Không khóa cứng danh mục nguồn ở Gate A khiến phát hiện mới bị bỏ qua. Nếu nguồn mới làm thay đổi tính khả thi của góc kể, trình bày vấn đề và xin chọn lại; không âm thầm đổi title/focus.

### Dữ liệu nghiệp vụ vẫn cần ngoài checkpoint

- Workflow container: chủ đề, graph/schema version, các branch references.
- Execution/artifact identity: agent step, exact input/output, prompt revision, model/provider/settings, timestamps; nguồn và feedback gắn execution cụ thể.
- Checkpoint reference: `thread_id`, `checkpoint_ns`, `checkpoint_id`; parent linkage từ saver.
- Branch reference: tên/ID, checkpoint head đang chọn, trạng thái chạy/chờ, revision hoặc lease cho delivery. Không có một `currentStep/currentVersion` toàn cục đại diện đúng mọi nhánh.
- Decision: user selection/approval/rejection gắn exact checkpoint và artifact IDs, không chỉ step type.
- Source artifact: URL/edition/title, bản nội dung đã đọc, locator trang/đoạn nếu có, retrieval time; không dùng cache extension làm kho lưu trữ lâu dài.
- Command/execution attempts: delivery ID/idempotency key và outcome; giữ failed/cancelled attempts trong audit history. Checkpoint successful state và attempt failure không phải cùng một đối tượng.

Không cần snapshot lại mọi transcript vào mọi node; lưu artifact một lần rồi tham chiếu ID. Không đưa credentials vào checkpoint, transcript exports hoặc Zod output.

### Các thao tác phải phân biệt

| Thao tác | Semantics |
|---|---|
| View/checkout | Chỉ đọc đường tổ tiên của checkpoint; không chạy LLM, không đổi nhánh khác. |
| Continue | Dùng output đã chọn để sinh successor mới. Nếu đã có successor, tạo nhánh bổ sung thay vì ghi đè. |
| Rerun step K | Chạy lại K từ checkpoint đầu vào của K; tạo kết quả thay thế trên nhánh mới. Không resume sau K rồi tưởng K đã rerun. |
| Edit output | Tạo revision checkpoint mới; giữ output gốc và ghi loại thao tác khác với kết quả LLM. |
| Đổi focus/nguồn | Fork ở checkpoint lựa chọn đầu flow, xây lại facts/dàn ý/script theo lineage mới. |
| Publish | Chỉ chọn leaf/artifact có review và approval phù hợp chính xác; không lấy report gần nhất toàn workflow. |

**Không đánh `STALE` mọi nhánh cũ.** Nhánh cũ vẫn hợp lệ với bộ upstream cũ của nó. Đầu ra cũ chỉ không được dùng thay cho đầu ra trong lineage mới. Approval cũ vẫn có giá trị với artifact cũ, nhưng không tự chuyển sang bản fork.

### Concurrency và delivery — mục 8 không tự biến mất nhờ cây

Cây ngăn việc ghi đè logic nhưng không tự chống hai worker ghi cùng head hoặc lỗi giữa commit và enqueue.
- Jobs mang branch identity, base checkpoint, operation/attempt identity; không chỉ `workflowRunId` và `loadLatestStepOutput`.
- Completion chỉ cập nhật head của nhánh/command nó sở hữu; không giành head mà người dùng vừa chọn cho nhánh khác.
- Serialize advancement trên cùng branch; có guard head/lease trước ghi kết quả. Các nhánh khác vẫn giữ lịch sử độc lập.
- Idempotent delivery/completion ngăn duplicate child do retry. Không tuyên bố model/tool execution exactly-once khi process crash giữa external call và commit.
- Quyết định + command intention/outbox cùng transaction; gửi qua pg-boss sau commit, có reconciliation cho command chưa delivery. Không gọi `boss.send()` bên trong Drizzle transaction trên singleton PGlite.
- Graph/prompt schema versions phải lưu để biết nhánh cũ dùng định nghĩa nào. Model hoặc tài liệu web thay đổi thì replay có thể khác, không phải phục hồi byte-for-byte.

## 7. Pi Web Access — có tool, nhưng SDK phải nạp rõ ràng

### Bằng chứng môi trường

- Pi global: `0.99.2`.
- Pi SDK cài trong demo: `0.87.1` (khác global).
- `pi-web-access` có sẵn trong user agent npm directory: `0.35.0`; manifest `pi.extensions: ["./dist"]`.
- Nguồn package tại `https://github.com/nicobailon/pi-web-access`.
- `apps/api/src/agents/agent-runner.ts` hiện dùng `noExtensions: true`, `tools: []`, `noTools: "all"`, `agentDir: process.cwd()`.

Do đó, cài ở global/user Pi không tự bật extension trong agent runner hiện tại.

### Hướng tích hợp đã xác minh bằng declarations/source local SDK

1. Pin extension release và cung cấp explicit extension path/package source cho `DefaultResourceLoader.additionalExtensionPaths`. Không tự nạp toàn bộ personal extensions.
2. Có thể giữ `noExtensions: true` để chặn discovery: source SDK `0.87.1` vẫn nạp **explicit** extension paths. Không đơn giản đổi thành false rồi vô tình kéo thêm các extension cá nhân.
3. Với research roles, chọn allowlist `web_search`, `fetch_content`, `get_search_content`; không giữ `tools: []` vì đó là allowlist rỗng chặn cả extension tools. `noTools: "builtin"` tắt default filesystem/bash tools; allowlist xác định chính xác web tools được expose.
4. Không bắt buộc `source_check` để biến phương pháp tìm nguồn nhiều phía thành một feature. Có thể bật khi có nhu cầu cụ thể, không thêm vào mặc định chỉ vì extension cung cấp.
5. Writer/Oralizer chủ yếu nhận nguồn/artifacts đã lưu, không tự tìm facts mới. Evaluator/Extractor/Checker có thể dùng web theo tool policy từng role.
6. Bind extension lifecycle theo SDK version đã pin; giữ `dispose()` trong finally, verify active tool names khi implement. Không import một default function giả định từ package hoặc truyền `extensions: [...]` như một option chưa tồn tại.
7. Với backend/headless, dùng search `workflow: "none"`, không mở curator/TUI hay phụ thuộc browser-cookie auth. Chọn provider có credentials/availability thật; `opencode-go` cho LLM không tự bảo đảm provider search hoạt động.

**Security:** không expose bash/read/write cho model không có nghĩa extension bị sandbox ở OS. Extension vẫn có quyền Node/Bun của process và có thể lưu cache, clone repo, dùng mạng. Tài liệu Pi cảnh báo rõ quyền này. Cần pin/review package và giới hạn network/tool parameters; coi trang web là dữ liệu không đáng tin, không phải lệnh hệ thống. [S8–S10]

### Quan trọng cho lịch sử không mất dữ liệu

Source extension đang cài cho thấy `session_shutdown` gọi `clearResults()`, còn `storage.ts` dùng cache TTL 1 giờ và giới hạn pruning. `responseId`/cache không phải permanent artifact ID của hệ thống.

Phải lưu phần nguồn thực sự đã dùng vào artifact storage thuộc workflow trước khi dispose session. Nếu tải async nền, cần hoàn tất/capture trước teardown. Do source có module-level result map, cần kiểm tra isolation giữa ephemeral sessions cùng process khi triển khai; không mặc định rằng cache là riêng từng workflow. Đây là rủi ro từ static source inspection, chưa tái hiện concurrency runtime.

## 8. Các phần plan hiện tại cần thay đổi

| File/phase | Delta bắt buộc |
|---|---|
| `plan.md` | Bỏ zero-DDL guarantee, effort 8h thiếu cơ sở và cam kết 100%; ghi engine decision + history preservation + reset legacy có kiểm soát. |
| Phase 1 | Category vs narrative option/title; early selection; source artifact IDs; exact lineage/checkpoint IDs; completed-review vs publish eligibility. |
| Phase 2 | Checkpoint/tree model, branch APIs và gates A/B/C; nếu chọn LangGraph thì bỏ state machine kép; jobs phải mang checkpoint/branch identity. |
| Phase 3 | S1 sinh nhiều hướng/title có căn cứ; S2 tìm thêm sử liệu nhiều phía theo sự kiện; acknowledge single-sided sources; bỏ template trận đánh và trích dẫn không thực đọc. |
| Phase 4 | Explicit web extension loading, role tool allowlists, durable source capture; Pi runner reuse; branch-bound delivery/attempts/outbox; sửa APIs và pg-boss batch shape theo repo. |
| Phase 5 | Tree/history navigation, view/rerun/continue riêng; chọn hướng đầu flow; approval/review/publish hiển thị theo nhánh; không chỉ tab số version phẳng. |
| Phase 6 | Chuyển thành typecheck/build + manual implementation verification; hoãn test cases/suites; bỏ yêu cầu tái tạo dữ kiện Bạch Đằng chưa được chứng minh và SLA 15–20s. |

Báo cáo này ghi yêu cầu và đề xuất; **chưa thay thế nội dung 7 file plan**, vì lựa chọn engine/persistence còn ảnh hưởng lớn tới toàn bộ file map và phase triển khai.

## 9. Recommendation và bước tiếp theo

1. Chọn **LangGraph.js làm workflow engine** nếu ưu tiên kiến trúc dựng sẵn có time travel/HITL, đồng ý adapter PGlite là phần tích hợp cần làm. Không thêm hosted service.
2. Chưa cài saver cộng đồng hiện tại; chọn phiên bản graph/checkpoint cụ thể và thiết kế saver nhận singleton, quản lý tables/migrations tại API. Chưa có runtime compatibility proof.
3. Giữ Pi SDK cho LLM/tools, nạp có chọn lọc `pi-web-access`; đưa durable artifacts vào history của ứng dụng thay vì phụ thuộc extension cache.
4. Sau khi xác nhận engine, viết lại plan tại chỗ theo mục 8. Không bắt đầu implement dựa vào plan cũ.
5. Không viết test suite trong phạm vi đã chốt. Typecheck/build và manual probes được làm trong implementation để xác minh plumbing, không biến thành dự án kiểm thử riêng.

### Câu hỏi chưa đóng

- Chấp nhận LangGraph + adapter PGlite, hay muốn giữ pg-boss/state machine và áp dụng checkpoint-tree pattern nội bộ? Đây là lựa chọn kiến trúc duy nhất cần chốt trước khi viết lại đầy đủ plan.
- Search provider và credentials khả dụng khi chạy demo headless; có thể để cấu hình ở implementation, không chặn quyết định cây.
- Danh sách category kể cuối cùng và default scale: dùng nhóm gợi ý từ nghiên cứu, không đoán thêm loại thứ năm hoặc ép ba tập cho mọi chủ đề.

## 10. Nguồn và provenance

- **S1 — LangGraph JS time travel:** https://docs.langchain.com/oss/javascript/langgraph/use-time-travel — nội dung đọc trực tiếp; replay/fork, rerun downstream, interrupts.
- **S2 — LangGraph JS checkpointers:** https://docs.langchain.com/oss/javascript/langgraph/checkpointers — nội dung đọc trực tiếp; `StateSnapshot`, `parentConfig`, immutable update, durability, saver methods.
- **S3 — LangGraph JS persistence:** https://docs.langchain.com/oss/javascript/langgraph/persistence — phân biệt checkpoint thread-scoped với store cross-thread.
- **S4 — Saver manifest:** https://registry.npmjs.org/@steerprotocol/langgraph-checkpoint-pglite/latest — registry trả `0.0.6`, peer ranges, gitHead.
- **S5 — Saver source pinned:** https://raw.githubusercontent.com/SteerProtocol/langgraph-checkpoint-pglite/c71cec49282ffd9e09e2791b3364392a9bdde854/src/index.ts — constructor, parentConfig, setup, transactions, lifecycle.
- **S6 — Saver README pinned:** https://raw.githubusercontent.com/SteerProtocol/langgraph-checkpoint-pglite/c71cec49282ffd9e09e2791b3364392a9bdde854/README.md — storage options, tự khai hỗ trợ Bun, không phải runtime proof.
- **S7 — LangGraph manifest:** https://registry.npmjs.org/@langchain/langgraph/latest — registry trả `1.4.18`, checkpoint `^1.1.5`, core/zod peer ranges; không tự cập nhật dependency dự án theo latest.
- **S8 — Pi SDK:** https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md — đọc bản global local `0.99.2`; đối chiếu actual installed SDK `0.87.1` declarations/source cho `noTools`, allowlists và explicit loader paths.
- **S9 — Pi session format:** https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md — JSONL tree, `id/parentId`, branch context.
- **S10 — Pi extensions/packages:** https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md và https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md — loading, lifecycle, OS permission warning.
- **S11 — Pi Web Access:** https://github.com/nicobailon/pi-web-access — README đọc phần install/features; thêm manifest, `index.ts`, `storage.ts` của installed `0.35.0` để kiểm tra tools/cache/lifecycle.
- **S12 — Temporal event/reset:** https://docs.temporal.io/workflow-execution/event — reset tạo execution mới và copy prefix history; cần Temporal Service.

### Repo evidence

- `apps/api/src/agents/agent-runner.ts`: SDK resources disabled, structured JSON validation, dispose lifecycle.
- `apps/api/src/queue/boss.ts`: `PgBoss({ db: fromPglite(pglite) })`.
- `packages/db/src/client.ts`: shared PGlite singleton và API-owned close.
- `packages/db/src/schema/step-versions.ts`: append-only outputs chưa có parent lineage.
- `packages/db/src/schema/workflow-steps.ts`: current/approved version phẳng theo loại step.
- `AGENTS.md`: zero-daemon, single runtime owner, no tests policy; web-tool exception được user yêu cầu ở lượt làm rõ này, chưa sửa instruction file.
