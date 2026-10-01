# Scout: Frontend Map (Flow-2 historical podcast pipeline)

Read-only map of the advertisement-specific web UI. Goal: exact render branches, API
calls, and minimal change set for the 7-step podcast flow (RESEARCHER, SOURCE_EVALUATOR,
FACT_EXTRACTOR, STORY_PLANNER, SCRIPT_WRITER, ORALIZER, FACT_CHECKER) + gates 0/1/2.

## step-card.tsx  (apps/web/components/step-card.tsx)
Exports: `StepCardProps` (interface), `StepCard(props: StepCardProps)`.
```
type: StepType; label: string; description: string; status: StepStatus;
currentVersion: number|null; approvedVersion: number|null;
incomingGuidance?: string|null; errorMessage?: string|null;
versions: StepVersion[]; isSubmitting?: boolean;
onRerun?:(feedback:string)=>Promise<void>;
onContinue?:(version:number,guidance?:string)=>Promise<void>;
onDirectEdit?:(baseVersion:number,editedOutput:unknown,note?:string)=>Promise<void>;
```
- `STEP_ICONS: Record<StepType, ...>` — L50-55 (EXTRACTOR/PLANNER/WRITER/REVIEWER only).
- `statusBadgeClass` L57-73, `statusLabel` L75-91 (VN strings for StepStatus).
- **Step-type render branches live L~245-345** inside `{output && (...)}`:
  - `type === "EXTRACTOR"` (~L246): `<dl>` productName/price/capacityMl/material/features.
  - `type === "PLANNER"` (~L277): targetAudience/tone/angle/headlineDirection/keyPoints.
  - `type === "WRITER"` (~L313): headline/body/callToAction.
  - `type === "REVIEWER"` (~L331): passed badge + issues[{claim,reason}].
- No `default` branch → a new StepType renders an empty bordered box (safe but useless).
- ActionDeck mounted only when `status==="WAITING_FOR_HUMAN"` (~L355).

## action-deck.tsx  (apps/web/components/action-deck.tsx)
Exports: `ActionDeck(props)` — local `interface ActionDeckProps` (NOT exported).
```
stepType: StepType; currentVersion: number; currentOutputJson?: unknown;
onRerun:(feedback:string)=>Promise<void>;
onContinue:(version:number,guidance?:string)=>Promise<void>;
onDirectEdit?:(baseVersion:number,editedOutput:unknown,note?:string)=>Promise<void>;
isSubmitting: boolean;
```
- Chips hardcoded per stepType L47-77: `rerunChips`/`continueChips` branch only on
  `stepType==="PLANNER"` vs else (ad wording: "dân văn phòng", "CTA mua ngay") → ad-specific.
- Two cards: RERUN (amber, L~150) and CONTINUE (emerald, L~200); JSON direct-edit form L96-146.
- One generic gate — no notion of gate 0/1/2 or multi-gate workflow.

## live-ad-preview.tsx  (apps/web/components/live-ad-preview.tsx)
Exports: `LiveAdPreview({ ad, plan, version })` — props inline, unexported:
`ad: Advertisement|null; plan?: ContentPlan|null; version?: number|null`.
- Single-ad card: plan tone/audience badges L~110, headline, body, CTA button.
- Copy handler joins `headline\n\nbody\n\n👉 callToAction` L18.
→ Fully ad-shaped; replaced by multi-episode script preview.

## quick-chips.tsx  (apps/web/components/quick-chips.tsx)
Exports: `QuickChips({ chips, onSelect, disabled })`.
`chips: string[]; onSelect:(chip:string)=>void; disabled?: boolean` — generic, reusable as-is.

## trace-panel.tsx  (apps/web/components/trace-panel.tsx)
Exports: `TracePanel({ workflowId, workflowStatus })`
`workflowId: number|null; workflowStatus?: WorkflowStatus|null`.
- `classify(e: WorkflowEvent): ItemVisual` L~63-160 detects agent from `pi.<AGENT>` or
  prefix in `["extractor","planner","writer","reviewer"]` (L~75) → **add 7 podcast slugs**
  or events fall back to "Log". `parseMeta`/`mergeEvents`/filter otherwise step-agnostic.

## page.tsx  (apps/web/app/page.tsx)
Default export `HomePage()`. State: rawInput, workflowId, workflow, starting,
acting, error, rightTab(`"preview"|"trace"|"json"`), pollRef.
- `DEFAULT_INPUT` L29-35 = water-bottle copy. → replace.
- `STEP_DEFINITIONS` L43-48 — **4 hardcoded entries** (types, VN labels, descriptions).
- `stepByType(steps, type)` L50, `isTerminal(status)` L54.
- Poll loop `useEffect` L75-99, `POLL_INTERVAL_MS=1500`.
- Handlers: `handleStart` L101, `handleRerun` L122, `handleContinue` L138,
  `handleDirectEdit` L154 — all call workflow-api, refetch.
- Step output extraction L176-187: `planner`/`writer` steps + `plannerOutput: ContentPlan`,
  `writerOutput: Advertisement` → ad-specific casts.
- Stepper header L~290 ("Tiến trình thực thi 4 bước"); `STEP_DEFINITIONS.map` → StepCard L~300.
- Right tabs: `LiveAdPreview` L~380 (preview), `TracePanel`, JSON dump L~395.

## workflow-api.ts  (apps/web/lib/workflow-api.ts) — `API_BASE_URL = NEXT_PUBLIC_API_URL || "http://localhost:3001"`
| Function | Endpoint |
|---|---|
| `createWorkflow(rawProductText)` | POST `/workflows` |
| `fetchWorkflow(id)` | GET `/workflows/:id` |
| `fetchWorkflowEvents(id, limit=200)` | GET `/events?workflowRunId=&limit=` |
| `subscribeWorkflowEvents(id, handlers, afterId=0)` | SSE GET `/events/stream?workflowRunId=&afterId=` |
| `rerunStep(id, stepType, feedback)` | POST `/workflows/:id/steps/:stepType/rerun` |
| `continueStep(id, stepType, version, incomingGuidance?)` | POST `/workflows/:id/steps/:stepType/continue` |
| `directEditStep(id, stepType, baseVersion, editedOutputJson, note?)` | POST `/workflows/:id/steps/:stepType/direct-edit` |
| `regeneratePlanner(id, feedback)` | thin alias → `rerunStep(id,"PLANNER",...)` |
| `approvePlanner(id, version)` | thin alias → `continueStep(id,"PLANNER",...)` |
Step endpoints are generic (`:stepType` string) → **reusable for 7 steps unchanged.**
`parseOrThrow<T>` L9; `WorkflowEventStreamHandlers` interface exported.

## Advertisement-specific → replace for podcast flow
1. `STEP_DEFINITIONS` (page.tsx L43-48): 4 ad steps → 7 podcast steps + 3 gates.
2. `step-card.tsx` render branches L245-345: EXTRACTOR/PLANNER/WRITER/REVIEWER
   visualizers → per-step visualizers (source matrix, narrative menu, execution
   tree, script preview, fact-check report).
3. `live-ad-preview.tsx`: single Advertisement card → multi-episode script preview.
4. `action-deck.tsx` chips L47-77 + "Duyệt bước {stepType}" wording → gate-aware
   labels/chips (gate 0/1/2).
5. `page.tsx` planner/writer casts L176-187 → generic step→output map.
6. `trace-panel.tsx` agent-prefix list L~75 → add 7 new agent slugs.
7. `DEFAULT_INPUT` (page.tsx L29-35) → podcast topic input.

## Minimal new/modified file list
New:
- `apps/web/components/source-matrix-card.tsx` — SOURCE_EVALUATOR credibility/source matrix.
- `apps/web/components/narrative-menu-card.tsx` — STORY_PLANNER narrative options (gate 1).
- `apps/web/components/execution-tree-view.tsx` — plan→script→oralize tree, FACT_EXTRACTOR.
- `apps/web/components/script-preview.tsx` — multi-episode script + oralized variants (ORALIZER).
- `apps/web/components/fact-check-report.tsx` — FACT_CHECKER results (gate 2).
- (optional) `apps/web/lib/step-registry.ts` — one array of 7 steps: type, label,
  gate index, visualizer key. Replaces STEP_DEFINITIONS + the step-card switch.
Modified:
- `apps/web/app/page.tsx` — STEP_DEFINITIONS→registry, generic output map, gate routing.
- `apps/web/components/step-card.tsx` — swap L245-345 switch to registry/visualizer map;
  add new StepTypes to `STEP_ICONS`.
- `apps/web/components/action-deck.tsx` — gate-aware chips/labels.
- `apps/web/components/live-ad-preview.tsx` — repurpose/rename to script preview.
- `apps/web/components/trace-panel.tsx` — extend agent-slug list.
- `packages/contracts/src/workflow/*` — StepTypeSchema enum (7 types) + per-step Zod outputs
  (owns the change that enables everything above).
New-API: HITL gates 0/1/2 reuse existing `rerunStep`/`continueStep`/`directEditStep`
endpoints (already `:stepType`-generic); only gate-ordering logic is new in page.tsx.
