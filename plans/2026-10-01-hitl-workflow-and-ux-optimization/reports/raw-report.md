# Human-in-the-Loop Implementation Plan

## I. Mục tiêu

Nâng workflow hiện tại từ:

```text
Extractor
→ Planner
→ HUMAN REVIEW
→ Writer
→ Reviewer
```

thành:

```text
Extractor
  AUTO_CONTINUE
       ↓
Planner
  REVIEW_REQUIRED
       ↓
 ┌────────────────────────────┐
 │ Rerun with Feedback        │
 │ Continue with Guidance     │
 └────────────────────────────┘
       ↓
Writer
  REVIEW_REQUIRED
       ↓
 ┌────────────────────────────┐
 │ Rerun with Feedback        │
 │ Continue with Guidance     │
 └────────────────────────────┘
       ↓
Reviewer
  AUTO_CONTINUE
       ↓
DONE
```

Hai thao tác HITL chuẩn:

```text
RERUN_WITH_FEEDBACK
= output hiện tại chưa tốt
= chạy lại chính step đó

CONTINUE_WITH_GUIDANCE
= output hiện tại đã chấp nhận
= approve version hiện tại
= truyền lời dặn cho step kế tiếp
```

Không implement live steering, SSE, WebSocket, XState, Redux.

---

## II. Review Policy

Thêm contract:

```ts
export const ReviewPolicySchema = z.enum([
  "AUTO_CONTINUE",
  "REVIEW_REQUIRED"
]);

export type ReviewPolicy =
  z.infer<typeof ReviewPolicySchema>;
```

Policy cố định:

```ts
export const STEP_REVIEW_POLICY = {
  EXTRACTOR: "AUTO_CONTINUE",
  PLANNER: "REVIEW_REQUIRED",
  WRITER: "REVIEW_REQUIRED",
  REVIEWER: "AUTO_CONTINUE",
} as const;
```

Không lưu `reviewPolicy` xuống DB vì đây là cấu hình workflow, không phải runtime state.

Đặt tại:

```text
packages/contracts/src/workflow/review-policy.ts
```

---

## III. Step Status

Mở rộng `StepStatus` hiện tại:

```ts
PENDING
QUEUED
RUNNING
WAITING_FOR_HUMAN
COMPLETED
STALE
FAILED
```

Ý nghĩa quan trọng:

```text
COMPLETED
= output hiện tại hợp lệ

WAITING_FOR_HUMAN
= agent đã chạy xong nhưng cần người quyết định

STALE
= output từng hợp lệ nhưng upstream đã thay đổi
```

Không xóa output khi `STALE`.

---

## IV. Database migration

Giữ nguyên:

```text
workflow_runs
workflow_steps
step_versions
system_events
```

Thêm bảng:

```text
step_transitions
```

Schema đề xuất:

```ts
stepTransitions {
  id
  workflowRunId

  fromStepId
  fromVersion

  toStepType

  guidance

  createdAt
}
```

Ý nghĩa ví dụ:

```text
Planner v2
   ↓
guidance:
"Writer hãy viết tối giản, tránh emoji"
   ↓
Writer
```

Không lưu guidance vào `workflow_steps`, vì guidance thuộc một lần transition cụ thể.

Tạo unique hoặc guard logic để một version không bị approve sang cùng downstream nhiều lần.

---

## V. Step version semantics

Mỗi lần agent thực sự chạy tạo một `step_versions` mới.

Ví dụ:

```text
Planner
├── v1
├── v2
└── v3
```

Không overwrite.

`workflow_steps.currentVersion` luôn chỉ version mới nhất.

`approvedVersion`:

```text
null
```

khi đang review.

Khi user chọn Continue:

```text
approvedVersion = currentVersion
```

Nếu rerun:

```text
approvedVersion = null
currentVersion++
```

---

## VI. Chuẩn hóa input của một agent execution

Mỗi execution cần biết ba loại context:

```ts
{
  businessInput,
  previousOutput?,
  humanFeedback?,
  incomingGuidance?
}
```

Ý nghĩa:

- `businessInput`: data contract từ upstream.
- `previousOutput + humanFeedback`: chỉ xuất hiện khi rerun chính step hiện tại.
- `incomingGuidance`: instruction do step trước gửi sang.

Không trộn `humanFeedback` với `incomingGuidance`.

---

## VII. Rerun With Feedback

API:

```http
POST /workflows/:workflowId/steps/:stepType/rerun
```

Body:

```ts
{
  version: number;
  feedback: string;
}
```

Ví dụ:

```json
{
  "version": 1,
  "feedback": "Bài viết quá quảng cáo. Viết lại tối giản hơn."
}
```

Backend validate:

```text
workflow tồn tại
step tồn tại
step.reviewPolicy = REVIEW_REQUIRED
step.status = WAITING_FOR_HUMAN
version = currentVersion
feedback không rỗng
```

Nếu sai state:

```http
409 Conflict
```

Nếu đúng:

```text
WAITING_FOR_HUMAN
        ↓
QUEUED
        ↓
RUNNING
        ↓
agent rerun
        ↓
new version
        ↓
WAITING_FOR_HUMAN
```

Rerun prompt nhận:

```text
Original business input
Previous output
Human feedback
```

Ví dụ Writer:

```text
Previous advertisement:
...

Human feedback:
"Bài quá quảng cáo. Viết lại theo phong cách tối giản."

Revise your previous output.
All factual constraints still apply.
```

---

## VIII. Continue With Guidance

API:

```http
POST /workflows/:workflowId/steps/:stepType/continue
```

Body:

```ts
{
  version: number;
  guidance?: string;
}
```

Ví dụ Planner:

```json
{
  "version": 2,
  "guidance": "Writer hãy dùng phong cách tối giản và tránh emoji."
}
```

Backend validate:

```text
step.status = WAITING_FOR_HUMAN
version = currentVersion
approvedVersion = null
next step tồn tại
```

Transaction:

```text
1. set approvedVersion = version
2. set step = COMPLETED
3. create step_transition
4. prepare next step
5. workflow = RUNNING
6. enqueue next job
```

Nếu guidance rỗng vẫn tạo transition với:

```text
guidance = null
```

---

## IX. Agent sau nhận guidance thế nào

Worker của downstream đọc:

```text
step_transitions
```

theo:

```text
toStepType = current step
workflowRunId = current workflow
```

Ví dụ Writer nhận:

```text
ProductData
Approved ContentPlan v2
Transition Guidance
```

Prompt thêm:

```text
Human guidance from the previous reviewed step:

"Use a minimal style and avoid emoji."

Follow this guidance unless it conflicts with factual product data
or your required output contract.
```

Priority:

```text
System Prompt
>
Business facts
>
Zod contract
>
Human guidance
>
Agent preference
```

Human guidance không được phép thay fact.

---

## X. Downstream invalidation

Nếu rerun một step mà downstream đã tồn tại:

```text
Extractor v1
↓
Planner v1
↓
Writer v1
```

sau đó rerun Extractor:

```text
Extractor v2
```

thì:

```text
Planner → STALE
Writer  → STALE
Reviewer → STALE
```

Không xóa versions cũ.

Algorithm:

```ts
invalidateDownstream(workflowId, fromStepType)
```

Ví dụ order:

```ts
const STEP_ORDER = [
  "EXTRACTOR",
  "PLANNER",
  "WRITER",
  "REVIEWER"
];
```

Tìm mọi step sau `fromStepType`:

```text
status = STALE
approvedVersion = null
```

Workflow sau đó quay về step vừa rerun.

---

## XI. Review-required step behavior

Nếu Writer đang review và rerun Writer:

```text
Writer v1
→ feedback
→ Writer v2
```

Reviewer nếu chưa chạy thì không cần làm gì.

Nếu Reviewer từng chạy rồi:

```text
Reviewer → STALE
```

Sau khi Writer v2 được Continue:

```text
Reviewer chạy version mới
```

---

## XII. State transition service

Tạo:

```text
apps/api/src/workflow/workflow-transition.service.ts
```

Không rải logic state vào route và worker.

Expose các hàm:

```ts
rerunStepWithFeedback()

continueStepWithGuidance()

markStepRunning()

completeAutoStep()

completeReviewableStep()

markStepFailed()

invalidateDownstream()
```

Routes chỉ:

```text
validate HTTP
↓
call service
↓
return response
```

Worker cũng gọi cùng service.

---

## XIII. Concurrency protection

Tất cả HITL transition phải chạy trong DB transaction.

Ví dụ user double-click Continue.

Request A:

```text
WAITING_FOR_HUMAN
→ COMPLETED
```

Request B tới sau:

```text
expected WAITING_FOR_HUMAN
actual COMPLETED
```

→ `409 Conflict`.

Không được enqueue Writer hai lần.

Kiểm tra đồng thời:

```text
workflow id
step id
status
currentVersion
approvedVersion
```

Version user gửi lên phải đúng current version.

---

## XIV. Queue payload

Giữ payload nhỏ:

```ts
{
  workflowRunId,
  stepId,
  version
}
```

Không truyền:

```text
ProductData
Plan
Feedback
Guidance
```

qua pg-boss.

Worker luôn đọc DB để lấy source of truth.

---

## XV. AUTO_CONTINUE behavior

Extractor và Reviewer không dừng.

Extractor:

```text
RUNNING
↓
output valid
↓
COMPLETED
↓
create/enqueue Planner
```

Planner:

```text
RUNNING
↓
output valid
↓
WAITING_FOR_HUMAN
```

Writer:

```text
RUNNING
↓
output valid
↓
WAITING_FOR_HUMAN
```

Reviewer:

```text
RUNNING
↓
output valid
↓
COMPLETED
↓
workflow COMPLETED
```

---

## XVI. Reviewer behavior

Writer Continue có thể gửi guidance:

```text
"Kiểm tra đặc biệt kỹ mọi con số."
```

Reviewer phải nhận guidance đó.

Nếu:

```json
{
  "passed": false
}
```

thì vẫn:

```text
Reviewer = COMPLETED
Workflow = COMPLETED
```

UI business result:

```text
FAILED FACT CHECK
```

Không biến thành technical `FAILED`.

---

## XVII. System events

Bổ sung event:

```text
step.rerun_requested
step.version_created
step.waiting_for_human
step.continued
step.guidance_created
step.invalidated
step.stale
```

Metadata ví dụ:

```json
{
  "stepType": "PLANNER",
  "fromVersion": 1,
  "newVersion": 2
}
```

và:

```json
{
  "fromStep": "PLANNER",
  "fromVersion": 2,
  "toStep": "WRITER",
  "hasGuidance": true
}
```

---

## XVIII. API response

`GET /workflows/:id` bổ sung cho mỗi step:

```ts
{
  type,
  status,
  reviewPolicy,

  currentVersion,
  approvedVersion,

  versions: [...],

  incomingGuidance,
  outgoingGuidance
}
```

Frontend không tự suy luận review policy.

Backend trả luôn:

```text
AUTO_CONTINUE
REVIEW_REQUIRED
```

---

## XIX. UI mới

Mỗi step thành một card:

```text
Planner                         WAITING

Version: v2

Output
────────────────────
...

Instruction
[________________________________]

[Run Again with Feedback]
[Continue with Guidance]
```

Textbox dùng chung nhưng semantics phụ thuộc nút.

Bấm `Run Again`:

```text
textbox = feedback cho chính Planner
```

Bấm `Continue`:

```text
textbox = guidance cho Writer
```

Helper text:

```text
Run Again: yêu cầu agent hiện tại sửa output.

Continue: giữ output này và gửi lời dặn
cho agent tiếp theo.
```

---

## XX. Version history UI

Cho Planner và Writer:

```text
v1
v2
v3 ← current
```

Click version cũ chỉ xem.

Không cho approve version cũ trong demo.

Nếu muốn dùng version cũ thì user phải rerun từ nó ở phase sau. Demo chưa cần.

---

## XXI. STALE UI

Nếu một upstream bị rerun:

```text
Writer v1     STALE
```

UI hiển thị:

```text
This output was generated from an older upstream version.
It is kept for history but is no longer active.
```

Không xóa card.

---

## XXII. Frontend state

Không thêm Redux, Zustand, XState.

Tiếp tục:

```text
React state
+
GET /workflows/:id polling mỗi 1 giây
```

Sau action:

```text
rerun
continue
```

disable hai button cho đến khi request trả về.

Backend vẫn phải chống double action dù frontend đã disable.

---

## XXIII. File structure thay đổi

```text
packages/contracts/src/workflow/
  review-policy.ts
  actions.ts
  api.ts

packages/db/src/schema/
  step-transitions.ts

apps/api/src/workflow/
  workflow.service.ts
  workflow-transition.service.ts
  workflow.repository.ts
  workflow-order.ts

apps/api/src/routes/
  workflow.route.ts

apps/api/src/queue/jobs/
  extractor.job.ts
  planner.job.ts
  writer.job.ts
  reviewer.job.ts

apps/api/src/agents/
  agent-runner.ts
  planner.agent.ts
  writer.agent.ts
```

Frontend:

```text
apps/web/components/workflow/
  workflow-view.tsx
  step-card.tsx
  review-controls.tsx
  version-list.tsx
```

Không bắt buộc chia component đúng y hệt nếu repo hiện tại đang đơn giản hơn.

---

## XXIV. Thứ tự implementation

Agent nên làm theo sequence:

```text
1. Contracts
2. DB migration step_transitions
3. STALE status
4. STEP_REVIEW_POLICY
5. workflow order helper
6. transition service
7. downstream invalidation
8. Rerun API
9. Continue API
10. Planner rerun migration sang abstraction mới
11. Planner guidance → Writer
12. Writer REVIEW_REQUIRED
13. Writer rerun
14. Writer guidance → Reviewer
15. Reviewer incoming guidance
16. GET workflow response mới
17. UI review controls
18. version history
19. stale display
20. concurrency guards
21. smoke verify
```

Không refactor toàn bộ project cùng lúc.

---

## XXV. Scenario test chính

Input:

```text
Bình giữ nhiệt 750ml.
Giữ lạnh 18 giờ.
Giữ nóng 10 giờ.
Vỏ inox.
Giá 299.000đ.
Đối tượng là sinh viên và dân văn phòng.
```

Expected:

```text
Extractor v1 COMPLETED
↓
Planner v1 WAITING
```

Feedback:

```text
Tập trung hoàn toàn vào sinh viên.
```

Action:

```text
Run Again with Feedback
```

Expected:

```text
Planner v2 WAITING
Planner v1 vẫn tồn tại
```

Guidance:

```text
Viết tối giản, tránh emoji,
tập trung bối cảnh đi học cả ngày.
```

Action:

```text
Continue with Guidance
```

Expected:

```text
Planner v2 APPROVED
transition:
Planner v2 → Writer + guidance
↓
Writer v1 WAITING
```

Writer feedback:

```text
Văn phong vẫn quá quảng cáo.
Viết lại tự nhiên hơn.
```

Expected:

```text
Writer v2 WAITING
Writer v1 vẫn tồn tại
```

Writer guidance:

```text
Khi review hãy kiểm tra kỹ
các con số giữ nóng và giữ lạnh.
```

Continue:

```text
Writer v2 APPROVED
↓
Reviewer
↓
COMPLETED
```

---

## XXVI. Test downstream invalidation

Sau khi full workflow đã hoàn thành, gọi rerun Planner nếu API cho phép rerun historical reviewed step trong demo mở rộng.

Expected:

```text
Planner v3
Writer → STALE
Reviewer → STALE
workflow → WAITING_FOR_HUMAN
```

Nếu muốn giữ scope nhỏ hơn, chỉ cần implement invalidation service trước và verify bằng smoke script, chưa cần expose UI rerun historical step.

Khuyến nghị: làm theo scope nhỏ này.

---

## XXVII. Definition of Done

Phase này hoàn thành khi chứng minh được:

```text
Planner
→ rerun với feedback
→ v2

Planner v2
→ continue với guidance
→ Writer nhận đúng guidance

Writer
→ rerun với feedback
→ v2

Writer v2
→ continue với guidance
→ Reviewer nhận đúng guidance
```

Đồng thời:

```text
version cũ không mất

guidance được persist

restart API không mất trạng thái review

double Continue không enqueue trùng

approve version cũ trả 409

rerun upstream làm downstream STALE

mọi agent output vẫn qua Zod

pg-boss vẫn là executor

PGlite vẫn là source of truth
```

Không cần thêm bất kỳ thư viện state nào.

Sau phase này, hệ thống đã có một abstraction HITL đủ sạch để mang sang workflow Sử Ký: **mỗi step có policy, version, rerun feedback, continue guidance và dependency downstream**.
