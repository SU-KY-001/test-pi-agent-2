# Phase 3 Report — 7 System Prompts & Text-for-Ear Rules

## Trạng thái: HOÀN TẤT
Prompt là module TypeScript có kiểu, không phải chuỗi rời. Nội dung bám `research/scout-reference-rules.md` (quy tắc biên tập podcast lịch sử) và golden sample.

## Tệp tạo mới
| Tệp | Vai trò |
| :--- | :--- |
| `apps/api/src/agents/prompts/researcher.prompt.ts` | Tư vấn biên tập Gate 0: sourcesCatalogue (có `tier`, `reliabilityScore`, `crossVerificationNotes`), `narrativeMenu` đủ 5 lựa chọn focusType, `initialResearchQuestions`, timeframe/geography. Công thức tiêu đề: `[Yếu tố định vị hoặc câu hỏi then chốt] + [Sự kiện/Nhân vật] + (Góc nhìn đặc thù)` |
| `apps/api/src/agents/prompts/source-evaluator.prompt.ts` | Thẩm định từng nguồn, gán tier + điểm tin cậy + ghi chú đối chiếu chéo |
| `apps/api/src/agents/prompts/fact-extractor.prompt.ts` | Bóc fact card từ nguồn Tier 1, giữ trích dẫn nguyên văn |
| `apps/api/src/agents/prompts/story-planner.prompt.ts` | Dàn ý SPDC 3 tập (SpdcCycle + pacing plan + outline từng tập) |
| `apps/api/src/agents/prompts/script-writer.prompt.ts` | Biên kịch văn xuôi lịch sử, chỉ dùng fact card + nguồn Tier 1 |
| `apps/api/src/agents/prompts/oralizer.prompt.ts` | Golden v2-1 rules cho Text-for-Ear: không gạch đầu dòng, không dấu hai chấm, không ngoặc đơn, không câu cụt, có liên từ nối |
| `apps/api/src/agents/prompts/fact-checker.prompt.ts` | Kiểm định từng claim, chấm điểm, phát hiện bịa đặt |
| `apps/api/src/agents/prompts/rollup-schemas.ts` | Schema JSON rút gọn đưa vào prompt để LLM biết đúng shape cần trả |
| `apps/api/src/agents/step-prompt.mapper.ts` | `STEP_TOOL_POLICY` (chỉ RESEARCHER = `"WEB"`), `StepPromptContext`, `buildStepPrompt(stepType, ctx)` map 7 bước → system + user prompt; `tierOneSources()` rút nguồn Tier 1 cho Script Writer |
| `apps/api/src/workflow/oral-linter.ts` | Linter tất định cho văn nói: `lintOralText` (gạch ngang/đầu dòng, hai chấm, ngoặc đơn, câu cụt), `describeLintFailure`, `ORAL_LINT_THRESHOLDS` + self-check chạy được |

## Quyết định quan trọng
- **Linter không giao cho LLM**: lỗi dấu câu là kết quả fail-fast tất định, không phải "lời phán" của model. Ngưỡng nằm ở `ORAL_LINT_THRESHOLDS` (nút hiệu chỉnh, không phải luật cứng) vì golden script có câu 8-10 từ nên không thể siết ngưỡng 12 từ.
- **Chỉ RESEARCHER có tool web**: 6 bước còn lại `noTools`, nên không thể tự bịa nguồn ngoài — mọi khẳng định phải đến từ research pack.
- Prompt nhận `previousOutputJson` để rerun/fork có thể sửa trên bản cũ thay vì sinh lại từ đầu.

## Kiểm chứng
`bun run apps/api/src/workflow/oral-linter.ts` (self-check `import.meta.main`): pass với văn sạch, bắt đúng dấu hai chấm, gạch đầu dòng, ngoặc đơn, câu cụt.

## Sai lệch so với plan
- Plan gọi file là `text-for-ear-linter.ts` (phase 4); thực tế đặt tại `apps/api/src/workflow/oral-linter.ts` ngay trong phase 3 vì prompt và linter là một cặp ràng buộc, tách ra chỉ làm khó tra cứu.
