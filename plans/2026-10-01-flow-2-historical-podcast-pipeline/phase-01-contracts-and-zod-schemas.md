# Phase 1: Contracts & Zod Schemas Refactoring

## 1. Mục tiêu
Thiết kế lại toàn bộ hợp đồng dữ liệu trong `packages/contracts/src/workflow/` để phản ánh đúng cấu trúc học thuật của Flow 2, bao gồm:
* Tư vấn biên tập (Ma trận nguồn kiểm chứng chéo + Menu trọng tâm kể kèm tiêu đề mẫu).
* Phân tầng nguồn tư liệu (Tier 1 đến Tier 4).
* Cấu trúc Research Pack (Fact Cards, Timeline, Entities, Relations, Research Gaps).
* Dàn ý 3 tập theo mô hình Situation - Problem - Decision - Consequence (SPDC).
* Bản thảo kịch bản và Bản kịch bản văn nói Text-for-Ear chuẩn hóa.
* Báo cáo kiểm định 2 tầng (Regex linter văn nói + Đối chiếu claim).

## 2. Danh sách tệp cần tạo mới & cập nhật

| Đường dẫn tệp | Thao tác | Mô tả chi tiết |
| :--- | :--- | :--- |
| `packages/contracts/src/workflow/execution-tree.ts` | Tạo mới | Định nghĩa `ExecutionNodeSchema`, `BranchLineageSchema`, `ForkStepPayloadSchema`, `PublicationRecordSchema`. |
| `packages/contracts/src/workflow/research-consultation.ts` | Tạo mới | Định nghĩa `TopicInputSchema`, `SourceItemSchema`, `NarrativeMenuOptionSchema`, `NarrativeFocusSelectionSchema`, `ResearchConsultationSchema`. |
| `packages/contracts/src/workflow/evaluated-corpus.ts` | Tạo mới | Định nghĩa `EvaluatedCorpusSchema` (nguồn đã xếp hạng, kiểm chứng chéo). |
| `packages/contracts/src/workflow/research-pack.ts` | Tạo mới | Định nghĩa `FactCardSchema`, `ResearchPackSchema`, `ResearchGapSchema`. |
| `packages/contracts/src/workflow/story-outline.ts` | Tạo mới | Định nghĩa `StoryEpisodeOutlineSchema`, `StoryOutlineSchema`. |
| `packages/contracts/src/workflow/podcast-script.ts` | Tạo mới | Định nghĩa `PodcastEpisodeDraftSchema`, `PodcastScriptDraftSchema`. |
| `packages/contracts/src/workflow/oralized-script.ts` | Tạo mới | Định nghĩa `OralizedEpisodeScriptSchema`, `OralizedScriptSchema`. |
| `packages/contracts/src/workflow/review-report.ts` | Tạo mới | Định nghĩa `OralLintErrorSchema`, `ClaimVerificationItemSchema`, `ReviewReportSchema`. |
| `packages/contracts/src/workflow/api.ts` | Cập nhật | Cập nhật `StepType` thành 7 giá trị mới, ánh xạ `StepPayloadMap` chính xác, bổ sung router cây thực thi. |
| `packages/contracts/src/workflow/index.ts` | Cập nhật | Re-export toàn bộ schema Flow 2 mới. |

## 3. Chi tiết Zod Schemas Cốt Lõi

### A. `research-consultation.ts`
```typescript
import { z } from "zod";

export const SOURCE_TIERS = ["TIER_1_CHINH_SU", "TIER_2_KHAO_CO", "TIER_3_KHOA_HOC", "TIER_4_DA_SU"] as const;
export const NARRATIVE_FOCUS_TYPES = [
  "DIEN_BIEN",
  "NGUYEN_NHAN",
  "NHAN_VAT",
  "CO_CHE_DIA_LOI",
  "Y_NGHIA_LICH_SU",
] as const;

export const SourceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  authorOrOrigin: z.string(),
  tier: z.enum(SOURCE_TIERS),
  tierDescription: z.string(),
  reliabilityScore: z.number().min(1).max(10),
  crossVerificationNotes: z.string(),
  isPrimaryAssertionSource: z.boolean(),
});

export const NarrativeMenuOptionSchema = z.object({
  focusType: z.enum(NARRATIVE_FOCUS_TYPES),
  focusLabel: z.string(),
  angleDescription: z.string(),
  seriesTitle: z.string(),
  episodeTitles: z.tuple([z.string(), z.string(), z.string()]),
  recommendedBecause: z.string(),
});

export const TopicInputSchema = z.object({
  topic: z.string().min(3),
  userProvidedSources: z.string().optional(),
});

export const NarrativeFocusSelectionSchema = z.object({
  selectedFocusType: z.enum(NARRATIVE_FOCUS_TYPES).or(z.literal("CUSTOM")),
  seriesTitle: z.string(),
  episodeTitles: z.tuple([z.string(), z.string(), z.string()]),
  editorialNotes: z.string().optional(),
});

export const ResearchConsultationSchema = z.object({
  topic: z.string(),
  historicalTimeframe: z.string(),
  geographicScope: z.string(),
  sourcesCatalogue: z.array(SourceItemSchema),
  narrativeMenu: z.array(NarrativeMenuOptionSchema),
  initialResearchQuestions: z.array(z.string()),
});
```

### B. `execution-tree.ts` (Lịch sử Thực thi Cây & Phân nhánh)
```typescript
import { z } from "zod";
import { STEP_TYPES } from "./api";

export const ExecutionNodeSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  stepType: z.enum(STEP_TYPES),
  parentVersionId: z.string().uuid().nullable(),
  versionNumber: z.number().int().positive(),
  status: z.enum(["QUEUED", "RUNNING", "WAITING_FOR_HUMAN", "COMPLETED", "FAILED"]),
  outputJson: z.unknown().nullable(),
  guidance: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const BranchLineageSchema = z.object({
  currentNodeId: z.string().uuid(),
  ancestorNodes: z.array(ExecutionNodeSchema),
  predecessorOutputs: z.record(z.string(), z.unknown()),
});

export const ForkStepPayloadSchema = z.object({
  workflowRunId: z.string().uuid(),
  forkFromVersionId: z.string().uuid(),
  feedbackOrGuidance: z.string().optional(),
  narrativeSelection: NarrativeFocusSelectionSchema.optional(),
});

export const PublicationRecordSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  approvedVersionId: z.string().uuid(),
  approvedBy: z.string(),
  finalScript: z.string(),
  totalWords: z.number().int(),
  estimatedDurationSeconds: z.number().int(),
  publishedAt: z.string().datetime(),
});
```

### C. `research-pack.ts`
```typescript
import { z } from "zod";

export const FactCardSchema = z.object({
  id: z.string(),
  claim: z.string(),
  timePoint: z.string().optional(),
  location: z.string().optional(),
  entitiesInvolved: z.array(z.string()),
  sourceReference: z.string(),
  citationSnippet: z.string(),
  confidence: z.enum(["CONFIRMED", "DEBATED", "INSUFFICIENT"]),
  potentialRelations: z.array(z.string()),
  narrativeRelevance: z.string(),
});

export const ResearchPackSchema = z.object({
  topic: z.string(),
  selectedNarrativeFocus: z.string(),
  factCards: z.array(FactCardSchema),
  chronologicalTimeline: z.array(z.object({
    time: z.string(),
    event: z.string(),
    factCardId: z.string(),
  })),
  keyEntities: z.array(z.object({
    name: z.string(),
    role: z.string(),
    historicalStance: z.string(),
  })),
  identifiedResearchGaps: z.array(z.string()),
});
```

### C. `story-outline.ts` (SPDC Model)
```typescript
import { z } from "zod";

export const StoryEpisodeOutlineSchema = z.object({
  episodeNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  episodeTitle: z.string(),
  centralQuestion: z.string(),
  spdcCycle: z.object({
    situation: z.string(),
    problem: z.string(),
    decision: z.string(),
    consequence: z.string(),
  }),
  narrativeBeats: z.array(z.string()),
  pacingPlan: z.object({
    summaryMoments: z.array(z.string()),
    detailedSceneMoments: z.array(z.string()),
  }),
  hookEnd: z.string(),
});

export const StoryOutlineSchema = z.object({
  seriesTitle: z.string(),
  narrativeFocus: z.string(),
  scale: z.literal("3_EPISODES"),
  episodes: z.tuple([
    StoryEpisodeOutlineSchema,
    StoryEpisodeOutlineSchema,
    StoryEpisodeOutlineSchema,
  ]),
});
```

### D. `oralized-script.ts` (Text-for-Ear)
```typescript
import { z } from "zod";

export const OralizedEpisodeScriptSchema = z.object({
  episodeNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  episodeTitle: z.string(),
  spokenNarration: z.string().describe("Văn nói thuần túy cho TTS: không dấu gạch ngang đầu dòng, không dấu hai chấm, không câu cụt lủn, có liên từ nối mượt mà"),
  wordCount: z.number(),
  estimatedDurationSeconds: z.number(),
  breathAndPacingNotes: z.string(),
});

export const OralizedScriptSchema = z.object({
  seriesTitle: z.string(),
  episodes: z.tuple([
    OralizedEpisodeScriptSchema,
    OralizedEpisodeScriptSchema,
    OralizedEpisodeScriptSchema,
  ]),
  totalWordCount: z.number(),
});
```

### E. `review-report.ts`
```typescript
import { z } from "zod";

export const ReviewReportSchema = z.object({
  passed: z.boolean(),
  overallScore: z.number().min(0).max(100),
  oralLinter: z.object({
    hasForbiddenHyphens: z.boolean(),
    hasForbiddenColons: z.boolean(),
    hasFragmentedSentences: z.boolean(),
    errorDetails: z.array(z.string()),
  }),
  claimVerification: z.array(z.object({
    scriptSentence: z.string(),
    matchedFactCardId: z.string().optional(),
    status: z.enum(["VERIFIED", "UNSUPPORTED_SPECULATION", "CONTRADICTION"]),
    explanation: z.string(),
  })),
  moderatorSummaryFeedback: z.string(),
});
```

## 4. Tiêu chí Hoàn thành (Success Criteria)
* Toàn bộ các file schema mới biên dịch thành công không có lỗi type.
* Lệnh `bun run --filter @repo/contracts typecheck` chạy qua sạch sẽ.
