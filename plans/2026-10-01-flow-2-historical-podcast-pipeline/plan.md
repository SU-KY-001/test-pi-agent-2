---
title: "Flow 2 Historical Podcast Pipeline & Editorial Co-Pilot Implementation Plan"
description: "Nâng cấp toàn diện pipeline 7 tác tử AI từ Flow 2 tài liệu nghiên cứu 'Sử Ký': tích hợp Tư vấn biên tập (Ma trận nguồn kiểm chứng chéo + Menu trọng tâm kể), chuẩn hóa Text-for-Ear từ bài học Bạch Đằng v2-1, và tối ưu hóa hàng đợi pg-boss trên PGlite."
status: pending
priority: P1
effort: 8h
branch: main
tags: [flow-2, historical-podcast, multi-agent, text-for-ear, pg-boss, contracts, pglite, frontend]
blockedBy: []
blocks: []
created: 2026-10-01
---

# Flow 2 Historical Podcast Pipeline & Editorial Co-Pilot Implementation Plan

## Overview

Kế hoạch này chuyển đổi toàn diện ứng dụng demo `test-pi-agent-2` từ quy trình quảng cáo sang **Hệ thống Tạo Kịch bản Podcast Lịch sử Đa Tác tử (Flow 2)** tuân thủ 100% các phát hiện học thuật trong:
1. `latex/260925053336-bao-cao-nghien-cuu-flow-2-su-ky.tex` (Kiến trúc Flow 2, phân tách 3 lớp, narrative focus, cấu trúc Fact Card & Research Pack).
2. `latex/260925035535-historical-storytelling-notes-v3.tex` (Cơ chế Situation-Problem-Decision-Consequence, ranh giới chứng cứ và ngôi kể thứ ba bị giới hạn bởi sử liệu).
3. Đúc kết thực tế từ kịch bản chuẩn vàng `outputs/series-bach-dang-938-v2-1.txt` (loại bỏ hoàn toàn câu cụt lủn, cấm dấu `-` và `:`, chêm từ nối tự nhiên cho máy đọc TTS).
4. Hai yêu cầu tăng cường nghiệp vụ từ Moderator: **Ma trận Nguồn kiểm chứng chéo (Source Cross-Verification Matrix)** và **Menu Trọng tâm kể kèm Tiêu đề mẫu (Narrative Menu Generator)**.
5. Kiến trúc **Cây Lịch sử Thực thi Bất biến (Native Execution Tree / Adjacency List)** xây dựng trực tiếp trên Drizzle ORM + PGlite: hỗ trợ quay lại xem node cũ, fork/nhánh mới, tiếp tục chạy mà không cần bất kỳ framework AI cồng kềnh nào (loại bỏ hoàn toàn LangGraph).
6. Tích hợp công cụ tìm kiếm trực tiếp qua **`pi-web-access`** được nạp tường minh vào Pi SDK runner kèm danh sách công cụ được cấp quyền (`web_search`, `fetch_content`).

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|-------------|------|--------|
| Supersedes | [2026-10-01-hitl-workflow-and-ux-optimization](../2026-10-01-hitl-workflow-and-ux-optimization/plan.md) | completed |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Contracts & Zod Schemas Refactoring](./phase-01-contracts-and-zod-schemas.md) | Pending |
| 2 | [Workflow State Machine & Queues Reconfiguration](./phase-02-workflow-state-machine-and-queues.md) | Pending |
| 3 | [System Prompts & Text-for-Ear Rules Engineering](./phase-03-system-prompts-and-text-for-ear.md) | Pending |
| 4 | [Agent Runners & pg-boss Queue Workers](./phase-04-agent-runners-and-workers.md) | Pending |
| 5 | [Frontend Editorial Dashboard & Dual-Gate UI](./phase-05-frontend-editorial-dashboard.md) | Pending |
| 6 | [End-to-End Verification with Golden Case Bạch Đằng 938](./phase-06-e2e-verification-and-bach-dang-probe.md) | Pending |

## Key Technical Decisions

1. **Native Execution Tree Architecture (Adjacency List trên Drizzle ORM & PGlite - Không dùng LangGraph)**:
   - Bài toán quản lý lịch sử thực thi, xem lại phiên bản cũ, fork/rẽ nhánh và chạy tiếp downstream **thuần túy là bài toán Cấu trúc Dữ liệu & Thiết kế CSDL (Adjacency List / Commit Graph kiểu Git)**.
   - Loại bỏ hoàn toàn ý định tích hợp LangGraph (tránh xung đột dependency, adapter PGlite lỗi thời, và cấu trúc trừu tượng không cần thiết).
   - Thiết kế trực tiếp bảng `step_versions` với cột `parent_version_id` (tự tham chiếu). Mỗi lần agent chạy sinh ra một node bất biến.
   - Hỗ trợ reset sạch sẽ CSDL PGlite cho demo Flow 2 (`bun run db:reset`), chuẩn hóa schema cho 7 step mà không cần các bản vá tạm bợ.
   - Truy vết ngữ cảnh tổ tiên (Lineage Reconstruction) cho các bước phía sau thông qua hàm đệ quy truy ngược `parent_version_id` lên root.
2. **Editorial Co-Pilot Pattern & 3 Trạm Kiểm duyệt HITL Chiến lược**:
   - Ngay tại Step 1 (`RESEARCHER`), hệ thống đóng vai trò cố vấn biên tập:
     - Xuất bản Ma trận nguồn uy tín xếp tầng (Tier 1 đến Tier 4) kèm kiểm chứng chéo và cảnh báo khoảng trống.
     - Đề xuất Menu Trọng tâm kể kèm các bộ tiêu đề mẫu cho Series và từng tập (3 tập).
   - **Gate 0 (Sau Researcher Consultation)**: Dừng lại chờ Moderator duyệt danh mục nguồn và chọn Trọng tâm kể (chọn từ tiêu đề mẫu hoặc tự nhập hướng riêng) TRƯỚC KHI chuyển sang thẩm định sâu và bóc Fact Cards.
   - **Gate 1 (Sau Story Planner)**: Moderator kiểm tra Dàn ý 3 tập theo mô hình SPDC trước khi tốn token viết văn xuôi dài.
   - **Gate 2 (Sau Fact Checker / Final Review)**: Moderator kiểm tra bản kịch bản hoàn chỉnh đã qua linter & đối chiếu claim, bấm duyệt Xuất bản.
3. **Thực thể Xuất bản Độc lập (Explicit Publication Record)**:
   - Tách rời trạng thái chạy (`workflow_runs.status`) với trạng thái xuất bản: tạo bản ghi `published_podcasts` gắn với `step_version_id` cụ thể đã được Moderator phê duyệt.
4. **Tích hợp Web Search qua `pi-web-access` trong Pi SDK**:
   - Nạp tường minh extension `pi-web-access` từ đường dẫn cục bộ vào phiên Pi SDK (`createAgentSession`) trong `agent-runner.ts`, cấp quyền allowlist cho các công cụ `web_search` và `fetch_content`.
   - Kết quả tra cứu trực tiếp được lưu bền vững thành artifact trong payload của version, không phụ thuộc vào bộ nhớ tạm của extension.
5. **Phân tách Độc lập giữa Scriptwriting và Oralization (Text-for-Ear)**:
   - Tách riêng `SCRIPT_WRITER` (bám sát Fact Cards và tính nhân quả) khỏi `ORALIZER` (chuyển thể sang văn nói Text-for-Ear).
   - Bài học từ bản `v2-1`: Khử triệt để câu cụt lủn, cấm dấu gạch ngang đầu dòng (`-`), cấm dấu hai chấm (`:`), cấm dấu ngoặc đơn (`()`), và bắt buộc chêm các liên từ chuyển ý tự nhiên ("Thế nhưng", "Điều đáng nói là", "Chính vì thế").
6. **Fact Checker Hai Tầng (Deterministic Linter + Semantic Claim Verification)**:
   - Tầng 1: Code Regex Linter quét lỗi văn nói (nhanh, 0 token, bắt sạch các ký tự cấm và câu cụt).
   - Tầng 2: Semantic Verification đối chiếu từng phát biểu sự thật trong kịch bản với Fact Cards ở Step 3 để ngăn chặn LLM tự suy diễn thêm chi tiết không có nguồn.

## File Map & Architecture Impact

```
test-pi-agent-2/
├── packages/contracts/src/workflow/
│   ├── index.ts                      # Re-export all Flow 2 schemas
│   ├── research-consultation.ts      # [NEW] TopicInputSchema, SourceItemSchema, NarrativeMenuSchema
│   ├── evaluated-corpus.ts           # [NEW] EvaluatedCorpusSchema (Tiering & Cross-Verification)
│   ├── research-pack.ts              # [NEW] FactCardSchema, ResearchPackSchema, ResearchGapSchema
│   ├── story-outline.ts              # [NEW] StoryOutlineSchema (3 episodes, SPDC model)
│   ├── podcast-script.ts             # [NEW] ScriptDraftSchema (Raw narration 3 episodes)
│   ├── oralized-script.ts            # [NEW] OralizedScriptSchema (Text-for-Ear v2-1 compliant)
│   └── review-report.ts              # [NEW] ReviewReportSchema (Linter + Claim alignment)
├── apps/api/src/
│   ├── workflow/
│   │   ├── workflow.types.ts         # Update STEP_TYPES (7 steps), WORKFLOW_QUEUES, contracts mapping
│   │   ├── workflow-order.ts         # Update STEP_ORDER and downstream logic
│   │   └── workflow-transition.service.ts # Handle transitions across 7 steps and 2 HITL gates
│   ├── agents/
│   │   ├── prompts.ts                # [HEAVY REWRITE] System prompts for all 7 agents with Golden v2-1 rules
│   │   ├── agent-runner.ts           # Zod schema validation & prompt hydration for 7 agent types
│   │   ├── researcher.agent.ts       # [NEW] Source matrix & Narrative menu consultation
│   │   ├── source-evaluator.agent.ts # [NEW] Source ranking & cross-verification
│   │   ├── fact-extractor.agent.ts   # [REWRITE] Fact card generator (replacing extractor)
│   │   ├── story-planner.agent.ts    # [REWRITE] 3-episode outliner with SPDC (replacing planner)
│   │   ├── script-writer.agent.ts    # [REWRITE] Detailed narrative writer (replacing writer)
│   │   ├── oralizer.agent.ts         # [NEW] Text-for-Ear spoken transformation
│   │   └── fact-checker.agent.ts     # [REWRITE] Regex linter + Semantic claim verification
│   └── queue/
│       ├── workers.ts                # Register 7 pg-boss queue handlers
│       └── jobs/                     # Discrete job processors for each agent
└── apps/web/
    ├── app/page.tsx                  # STEP_DEFINITIONS (7 steps), consultation selectors
    ├── components/
    │   ├── step-card.tsx             # Rendering versions & guidance across 7 steps
    │   ├── source-matrix-card.tsx    # [NEW] Visual rendering for Tiered Sources & Cross-verification
    │   ├── narrative-menu-card.tsx   # [NEW] Interactive cards to preview & select narrative angles
    │   ├── live-script-preview.tsx   # [REWRITE] Multi-episode podcast script reader & TTS prepper
    │   └── action-deck.tsx           # HITL approval, guidance input & quick chips for historical podcasting
```
