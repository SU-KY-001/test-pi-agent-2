# Phase 2: Workflow State Machine & Queues Reconfiguration

## 1. Mục tiêu
Tái cấu trúc máy trạng thái (State Machine) và định nghĩa hàng đợi trong `apps/api/src/workflow/` kết hợp với **Cây Lịch sử Thực thi (Native Execution Tree / Adjacency List)** trên PGlite và Drizzle ORM (không dùng LangGraph).
Hỗ trợ 7 bước tuần tự và cơ chế Human-in-the-Loop (HITL) 3 chặng chiến lược:
* **Gate 0 (Chọn Trọng tâm kể):** Sau khi `RESEARCHER` hoàn thành bản tư vấn, workflow dừng lại ở `WAITING_FOR_HUMAN`. Moderator duyệt Ma trận Nguồn và chọn Trọng tâm kể (chọn từ các bộ tiêu đề mẫu hoặc tự nhập) trước khi kích hoạt nghiên cứu thẩm định sâu.
* **Gate 1 (Biên tập Dàn ý):** Sau khi `STORY_PLANNER` hoàn thành, workflow dừng lại ở `WAITING_FOR_HUMAN`. Moderator duyệt Dàn ý 3 tập theo SPDC trước khi tiến hành viết kịch bản.
* **Gate 2 (Phê duyệt Xuất bản):** Sau khi `FACT_CHECKER` kiểm định xong kịch bản văn nói, workflow dừng lại ở `WAITING_FOR_HUMAN` lần 3 để Moderator nghe thử/kiểm tra trước khi bấm Phê duyệt Xuất bản (lưu vào bảng `published_podcasts`).

## 2. Danh sách tệp cần cập nhật

| Đường dẫn tệp | Thao tác | Mô tả chi tiết |
| :--- | :--- | :--- |
| `packages/db/src/schema/workflow.ts` | Cập nhật | Bổ sung cột `parent_version_id` vào `step_versions`, bổ sung bảng `published_podcasts`. |
| `packages/db/src/scripts/reset.ts` | Tạo mới | Script reset CSDL PGlite sạch sẽ cho demo Flow 2 (`bun run db:reset`). |
| `apps/api/src/workflow/workflow.types.ts` | Cập nhật | Cập nhật `STEP_TYPES` (7 tác tử), `WORKFLOW_QUEUES` (7 queues), payload `parentVersionId` cho các job. |
| `apps/api/src/workflow/workflow-order.ts` | Cập nhật | Khai báo `STEP_ORDER`, danh sách 3 bước HITL (`HITL_GATED_STEPS = ["RESEARCHER", "STORY_PLANNER", "FACT_CHECKER"]`). |
| `apps/api/src/workflow/workflow-lineage.service.ts` | Tạo mới | Dịch vụ truy vết đệ quy tổ tiên (`getAncestryLineage`) từ `parentVersionId` lên root. |
| `apps/api/src/workflow/workflow-transition.service.ts` | Cập nhật | Logic chuyển giao dữ liệu theo nhánh cây, tạo version con mới, xử lý Rerun/Fork/Continue. |
| `apps/api/src/workflow/publication.service.ts` | Tạo mới | Dịch vụ lưu trữ kịch bản xuất bản độc lập gắn với `approved_version_id`. |
| `apps/api/src/workflow/workflow.service.ts` | Cập nhật | Khởi tạo workflow với step đầu tiên là `RESEARCHER`, xử lý input ban đầu (`topic`). |

## 3. Chi tiết Kỹ thuật

### A. Thiết kế CSDL Cây Lịch sử Thực thi (`packages/db`)
```typescript
// Trong packages/db/src/schema/workflow.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const stepVersions = pgTable("step_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowRunId: uuid("workflow_run_id").notNull().references(() => workflowRuns.id, { onDelete: "cascade" }),
  stepType: text("step_type").notNull(),
  parentVersionId: uuid("parent_version_id"), // Self-reference Adjacency List: trỏ về node cha
  versionNumber: integer("version_number").notNull(),
  outputJson: jsonb("output_json"),
  guidance: text("guidance"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publishedPodcasts = pgTable("published_podcasts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowRunId: uuid("workflow_run_id").notNull().references(() => workflowRuns.id),
  approvedVersionId: uuid("approved_version_id").notNull().references(() => stepVersions.id),
  approvedBy: text("approved_by").notNull(),
  finalScript: text("final_script").notNull(),
  wordCount: integer("word_count").notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});
```

### B. Cập nhật `workflow.types.ts` & `workflow-order.ts`
```typescript
export const STEP_TYPES = [
  "RESEARCHER",
  "SOURCE_EVALUATOR",
  "FACT_EXTRACTOR",
  "STORY_PLANNER",
  "SCRIPT_WRITER",
  "ORALIZER",
  "FACT_CHECKER",
] as const;

export type StepType = (typeof STEP_TYPES)[number];

export const WORKFLOW_QUEUES = {
  RESEARCHER: "agent.research-consultation",
  SOURCE_EVALUATOR: "agent.evaluate-sources",
  FACT_EXTRACTOR: "agent.extract-facts",
  STORY_PLANNER: "agent.plan-story",
  SCRIPT_WRITER: "agent.write-script",
  ORALIZER: "agent.oralize-script",
  FACT_CHECKER: "agent.check-facts",
} as const;

export const STEP_ORDER: readonly StepType[] = [
  "RESEARCHER",
  "SOURCE_EVALUATOR",
  "FACT_EXTRACTOR",
  "STORY_PLANNER",
  "SCRIPT_WRITER",
  "ORALIZER",
  "FACT_CHECKER",
] as const;

/** Ba trạm bắt buộc dừng chờ người kiểm duyệt (Human-in-the-Loop) */
export const HITL_GATED_STEPS: readonly StepType[] = [
  "RESEARCHER",
  "STORY_PLANNER",
  "FACT_CHECKER",
] as const;

export interface AgentJobPayload {
  workflowRunId: string;
  stepType: StepType;
  parentVersionId: string | null;
  guidance?: string;
  narrativeSelection?: {
    selectedFocusType: string;
    seriesTitle: string;
    episodeTitles: [string, string, string];
    editorialNotes?: string;
  };
}
```

### C. Dịch vụ Truy vết Tổ tiên (`workflow-lineage.service.ts`)
```typescript
export async function getAncestryLineage(parentVersionId: string): Promise<{
  ancestors: StepVersion[];
  predecessorOutputs: Record<string, unknown>;
}> {
  // Đi ngược parent_version_id lên root
  const ancestors: StepVersion[] = [];
  let currentId: string | null = parentVersionId;

  while (currentId) {
    const version = await db.query.stepVersions.findFirst({
      where: eq(stepVersions.id, currentId),
    });
    if (!version) break;
    ancestors.unshift(version); // Đưa vào đầu danh sách để giữ thứ tự thời gian
    currentId = version.parentVersionId;
  }

  const predecessorOutputs: Record<string, unknown> = {};
  for (const node of ancestors) {
    if (node.outputJson) {
      predecessorOutputs[node.stepType] = node.outputJson;
    }
  }

  return { ancestors, predecessorOutputs };
}
```

### D. Cơ chế Dòng dữ liệu chuyển tiếp (Step Pipeline Data Flow)
1. **Khởi tạo (`workflow_runs`):**
   * Moderator nhập `topic` (ví dụ: `"Trận Bạch Đằng năm 938"`).
   * Tạo job đầu tiên với `parentVersionId: null` vào queue `agent.research-consultation`.
2. **RESEARCHER $\rightarrow$ 🛑 HITL GATE 0 (Chọn Trọng tâm kể):**
   * Researcher sinh Ma trận Nguồn & Menu Trọng tâm kể. Tạo node `v1_researcher (parent: null)`.
   * Do `isHitlGatedStep("RESEARCHER") === true`, dừng lại ở `WAITING_FOR_HUMAN`.
   * Moderator xem Menu, click chọn Trọng tâm (hoặc nhập custom) $\rightarrow$ Bấm `[Duyệt & Tiếp tục]`.
   * Hệ thống đẩy job `SOURCE_EVALUATOR` vào queue với `parentVersionId: v1_researcher.id` kèm payload `narrativeSelection`.
3. **SOURCE_EVALUATOR $\rightarrow$ FACT_EXTRACTOR:**
   * Source Evaluator chạy theo ngữ cảnh của `v1_researcher`, sinh node `v1_evaluator (parent: v1_researcher.id)`.
   * Tự động đẩy job `FACT_EXTRACTOR` với `parentVersionId: v1_evaluator.id`.
4. **FACT_EXTRACTOR $\rightarrow$ STORY_PLANNER:**
   * Fact Extractor tạo `v1_facts (parent: v1_evaluator.id)`.
   * Tự động đẩy job `STORY_PLANNER` với `parentVersionId: v1_facts.id`.
5. **STORY_PLANNER $\rightarrow$ 🛑 HITL GATE 1 (Biên tập Dàn ý):**
   * Story Planner tạo `v1_outline (parent: v1_facts.id)`.
   * Dừng lại ở `WAITING_FOR_HUMAN`.
   * Moderator có thể:
     - `Fork/Rerun with Feedback`: Chọn sửa lại dàn ý, tạo nhánh mới từ `v1_facts.id`. Nhánh cũ giữ nguyên.
     - `Continue with Guidance`: Duyệt dàn ý $\rightarrow$ Đẩy job `SCRIPT_WRITER` với `parentVersionId: v1_outline.id`.
6. **SCRIPT_WRITER $\rightarrow$ ORALIZER:**
   * Script Writer đọc lineage của `v1_outline.id`, viết văn bản tự sự 3.000 - 4.500 từ, tạo `v1_script (parent: v1_outline.id)`.
   * Tự động đẩy job `ORALIZER` với `parentVersionId: v1_script.id`.
7. **ORALIZER $\rightarrow$ FACT_CHECKER:**
   * Oralizer gọt giũa Text-for-Ear v2-1, tạo `v1_oral (parent: v1_script.id)`.
   * Tự động đẩy job `FACT_CHECKER` với `parentVersionId: v1_oral.id`.
8. **FACT_CHECKER $\rightarrow$ 🛑 HITL GATE 2 (Phê duyệt Xuất bản):**
   * Fact Checker chạy linter regex + semantic claim verification, tạo `v1_checker (parent: v1_oral.id)`.
   * Dừng lại ở `WAITING_FOR_HUMAN`.
   * Moderator kiểm tra kịch bản hoàn chỉnh. Bấm `[Phê duyệt Xuất bản]` $\rightarrow$ Tạo bản ghi trong `published_podcasts` gắn với `approvedVersionId: v1_oral.id`, workflow chuyển `COMPLETED`.

## 4. Tiêu chí Hoàn thành
* Cây lịch sử phân nhánh Adjacency List hoạt động chuẩn xác: mọi node lưu đúng `parent_version_id`.
* Không có bất kỳ phụ thuộc nào vào LangGraph.
* 3 cổng HITL dừng đúng vị trí và mở khóa đúng nhánh con.
* Lệnh `bun run --filter apps/api typecheck` thành công không có lỗi type.
