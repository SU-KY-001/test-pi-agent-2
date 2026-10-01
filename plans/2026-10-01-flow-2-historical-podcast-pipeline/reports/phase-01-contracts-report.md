# Phase 1 Report — Contracts & Zod Schemas (Flow 2)

## Trạng thái: HOÀN TẤT
`bun --cwd packages/contracts typecheck` sạch.

## Tệp tạo mới
| Tệp | Nội dung |
| :--- | :--- |
| `packages/contracts/src/workflow/research-consultation.ts` | `SOURCE_TIERS` (TIER_1_CHINH_SU / TIER_2_KHAO_CO / TIER_3_KHOA_HOC / TIER_4_DA_SU), `NARRATIVE_FOCUS_TYPES`, `SourceItemSchema`, `NarrativeMenuOptionSchema`, `NarrativeFocusSelectionSchema`, `ResearchConsultationSchema` |
| `packages/contracts/src/workflow/evaluated-corpus.ts` | Ma trận nguồn sau thẩm định (`evaluatedSources` với tier + reliabilityScore + crossVerificationNotes) |
| `packages/contracts/src/workflow/research-pack.ts` | Fact cards / research pack sau bóc tách |
| `packages/contracts/src/workflow/story-outline.ts` | `SpdcCycleSchema`, `PacingPlanSchema`, `StoryEpisodeOutlineSchema`, `StoryOutlineSchema` (dàn ý 3 tập) |
| `packages/contracts/src/workflow/podcast-script.ts` | `PodcastScriptDraftSchema` (bản văn xuôi của biên kịch) |
| `packages/contracts/src/workflow/oralized-script.ts` | `OralizedScriptSchema` + `OralizedEpisodeScriptSchema` (Text-for-Ear, tuple đúng 3 tập) |
| `packages/contracts/src/workflow/review-report.ts` | `OralLintErrorSchema`, `ClaimVerificationItemSchema`, `CoreFactCoverageItemSchema`, `FactCheckerOutputSchema`, `ReviewReportSchema` |
| `packages/contracts/src/workflow/execution-tree.ts` | `ExecutionNodeSchema`, `BranchLineageSchema`, `ForkStepPayloadSchema`, `PublicationRecordSchema` |
| `packages/contracts/src/workflow/actions.ts` | Schema cho continue / rerun (fork) / direct-edit |

## Tệp cập nhật
- `packages/contracts/src/workflow/api.ts`: `STEP_TYPES` 7 bước Flow 2, `HITL_GATED_STEPS = ["RESEARCHER","STORY_PLANNER","FACT_CHECKER"]`, `isHitlGatedStep`, `nextStepType`, `STEP_OUTPUT_SCHEMAS`, `StepPayloadMap`, các schema request/response (`CreateWorkflowRequestSchema`, `GetWorkflowResponseSchema`, `WorkflowTreeResponseSchema`, …).
- `packages/contracts/src/workflow/review-policy.ts`: `reviewPolicyFor` / `reviewerFor` / `STEP_REVIEWER` (nhãn tiếng Việt cho dashboard).
- `packages/contracts/src/workflow/index.ts`: export toàn bộ schema mới.

## Quyết định quan trọng
- **D1 — ID dạng số, không phải UUID**: node dùng `parentVersionId` kiểu `serial` của PGlite, đơn giản hơn cho tầng queue/route và vẫn dựng được cây adjacency list.
- **Bảy bước là tuyến tính** (`STEP_ORDER`), nhánh chỉ sinh ra khi Moderator fork; không dựng DAG động.
- **Ba trạm HITL** đặt ở RESEARCHER (Gate 0 — chọn trọng tâm kể), STORY_PLANNER (Gate 1 — duyệt dàn ý), FACT_CHECKER (Gate 2 — duyệt xuất bản). Các bước còn lại `AUTO_CONTINUE`.
- Zod là nguồn sự thật duy nhất cho status enum (`STEP_STATUSES` trong `workflow.types.ts` là bản sao có kiểu; cột DB vẫn là `text`).

## Sai lệch so với plan
- Không có sai lệch lớn; `execution-tree.ts` bổ sung `PublicationRecordSchema` để dashboard đọc bản ghi xuất bản qua `GET /workflows/:id/tree` thay vì tự gọi DB.
