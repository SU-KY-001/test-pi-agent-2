"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Code2,
  FileText,
  Loader2,
  Sparkles,
  TreePine,
} from "lucide-react";
import {
  OralizedScriptSchema,
  ResearchConsultationSchema,
  ReviewReportSchema,
  StoryOutlineSchema,
  type GetWorkflowResponse,
  type NarrativeFocusSelection,
  type StepType,
  type StepVersion,
  type WorkflowTreeResponse,
} from "@repo/contracts";
import {
  continueStep,
  createWorkflow,
  directEditStep,
  fetchWorkflow,
  fetchWorkflowTree,
  rerunStep,
} from "../lib/workflow-api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TracePanel } from "@/components/trace-panel";
import { StepCard } from "@/components/step-card";
import { ExecutionTreeView } from "@/components/execution-tree-view";
import { NarrativeMenuCard } from "@/components/narrative-menu-card";
import { LivePodcastPreview, formatDuration } from "@/components/live-podcast-preview";

const DEFAULT_TOPIC = "Trận Bạch Đằng năm 938: Ngô Quyền chống quân Nam Hán";

const POLL_INTERVAL_MS = 2000;

type StepView = GetWorkflowResponse["steps"][number];
type ActiveVersions = Partial<Record<StepType, number>>;

interface StepDefinition {
  type: StepType;
  label: string;
  description: string;
  gate: string | null;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    type: "RESEARCHER",
    label: "1. Tư vấn biên tập",
    description: "Lập ma trận nguồn uy tín & đề xuất menu 5 trọng tâm kể",
    gate: "Gate 0 · duyệt nguồn & chọn trọng tâm kể",
  },
  {
    type: "SOURCE_EVALUATOR",
    label: "2. Thẩm định nguồn",
    description: "Xếp tầng nguồn Tier 1-4 & kiểm chứng chéo tư liệu",
    gate: null,
  },
  {
    type: "FACT_EXTRACTOR",
    label: "3. Bóc tách dữ kiện",
    description: "Tạo fact card độc lập, niên đại & khoảng trống sử liệu",
    gate: null,
  },
  {
    type: "STORY_PLANNER",
    label: "4. Dàn ý SPDC 3 tập",
    description: "Áp mô hình Situation-Problem-Decision-Consequence cho 3 tập",
    gate: "Gate 1 · biên tập dàn ý SPDC",
  },
  {
    type: "SCRIPT_WRITER",
    label: "5. Biên kịch văn xuôi",
    description: "Viết bản tự sự chi tiết 3.000 - 4.500 từ theo tư liệu",
    gate: null,
  },
  {
    type: "ORALIZER",
    label: "6. Chuyển thể văn nói",
    description: "Khử câu cụt, cấm dấu gạch ngang và dấu hai chấm, chêm liên từ cho TTS",
    gate: null,
  },
  {
    type: "FACT_CHECKER",
    label: "7. Kiểm định & chống bịa đặt",
    description: "Linter ký tự cấm & đối chiếu từng claim với fact card",
    gate: "Gate 2 · phê duyệt xuất bản",
  },
];

function stepByType(steps: StepView[], type: StepType): StepView | undefined {
  return steps.find((step) => step.type === type);
}

function activeVersionFor(step: StepView | undefined, overrides: ActiveVersions): number | null {
  if (!step) return null;
  const override = overrides[step.type];
  if (override != null) return override;
  // currentVersion là node mới nhất: sau khi rerun tạo nhánh mới, approvedVersion
  // vẫn trỏ về node cũ nên phải ưu tiên node mới để không giấu nhánh vừa sinh.
  if (step.currentVersion != null) return step.currentVersion;
  if (step.approvedVersion != null) return step.approvedVersion;
  const last = step.versions[step.versions.length - 1];
  return last ? last.version : null;
}

function versionNodeAt(step: StepView | undefined, version: number | null): StepVersion | null {
  if (!step || version == null) return null;
  return step.versions.find((item) => item.version === version) ?? null;
}

/**
 * Truy ngược từ node Kiểm định về node Chuyển thể văn nói trên cùng nhánh
 * để lấy đúng kịch bản đã được kiểm định.
 */
function findOralizerAncestor(
  tree: WorkflowTreeResponse | null,
  fromNodeId: number | null
): { nodeId: number; version: number } | null {
  if (!tree || fromNodeId == null) return null;
  const byId = new Map(tree.nodes.map((node) => [node.id, node]));
  let current = byId.get(fromNodeId);
  const seen = new Set<number>();
  while (current) {
    if (current.stepType === "ORALIZER") return { nodeId: current.id, version: current.version };
    if (current.parentVersionId == null || seen.has(current.parentVersionId)) return null;
    seen.add(current.parentVersionId);
    current = byId.get(current.parentVersionId);
  }
  return null;
}

export default function HomePage() {
  const [topic, setTopic] = useState<string>(DEFAULT_TOPIC);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [tree, setTree] = useState<WorkflowTreeResponse | null>(null);
  const [activeVersions, setActiveVersions] = useState<ActiveVersions>({});
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"script" | "tree" | "trace" | "json">("script");

  const refresh = useCallback(async () => {
    if (workflowId == null) return;
    try {
      const [run, treeData] = await Promise.all([fetchWorkflow(workflowId), fetchWorkflowTree(workflowId)]);
      setWorkflow(run);
      setTree(treeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [workflowId]);

  useEffect(() => {
    if (workflowId == null) return;
    void refresh();
  }, [workflowId, refresh]);

  const polling = workflow != null && (workflow.status === "RUNNING" || workflow.status === "PENDING");
  useEffect(() => {
    if (workflowId == null || !polling) return;
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [workflowId, polling, refresh]);

  const runAction = useCallback(
    async (workflowStepType: StepType, action: () => Promise<unknown>) => {
      if (workflowId == null || acting) return;
      setActing(true);
      setError(null);
      try {
        await action();
        setActiveVersions((prev) => {
          const next = { ...prev };
          delete next[workflowStepType];
          return next;
        });
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setActing(false);
      }
    },
    [workflowId, acting, refresh]
  );

  const handleStart = async () => {
    const trimmed = topic.trim();
    if (trimmed.length < 3 || starting) return;
    setStarting(true);
    setError(null);
    try {
      const created = await createWorkflow(trimmed);
      setWorkflowId(created.id);
      setWorkflow(null);
      setTree(null);
      setActiveVersions({});
      setRightTab("script");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleRerun = (type: StepType, feedback: string) =>
    runAction(type, () => rerunStep(workflowId as number, type, feedback));

  const handleContinue = (type: StepType, version: number, guidance?: string) =>
    runAction(type, () => continueStep(workflowId as number, type, version, { incomingGuidance: guidance }));

  const handleGateZeroApprove = (version: number, selection: NarrativeFocusSelection) =>
    runAction("RESEARCHER", () =>
      continueStep(workflowId as number, "RESEARCHER", version, { narrativeSelection: selection })
    );

  const handleDirectEdit = (type: StepType, baseVersion: number, editedOutput: unknown, note?: string) =>
    runAction(type, () => directEditStep(workflowId as number, type, baseVersion, editedOutput, note));

  const researchStep = workflow ? stepByType(workflow.steps, "RESEARCHER") : undefined;
  const storyStep = workflow ? stepByType(workflow.steps, "STORY_PLANNER") : undefined;
  const oralizerStep = workflow ? stepByType(workflow.steps, "ORALIZER") : undefined;
  const checkerStep = workflow ? stepByType(workflow.steps, "FACT_CHECKER") : undefined;

  const researchVersion = activeVersionFor(researchStep, activeVersions);
  const storyVersion = activeVersionFor(storyStep, activeVersions);
  const checkerVersion = activeVersionFor(checkerStep, activeVersions);

  const consultationParsed = ResearchConsultationSchema.safeParse(
    versionNodeAt(researchStep, researchVersion)?.outputJson
  );
  const consultation = consultationParsed.success ? consultationParsed.data : null;
  const outlineParsed = StoryOutlineSchema.safeParse(versionNodeAt(storyStep, storyVersion)?.outputJson);
  const outline = outlineParsed.success ? outlineParsed.data : null;
  const reportParsed = ReviewReportSchema.safeParse(versionNodeAt(checkerStep, checkerVersion)?.outputJson);
  const report = reportParsed.success ? reportParsed.data : null;

  const lintClean = report
    ? !report.oralLinter.hasForbiddenHyphens &&
      !report.oralLinter.hasForbiddenColons &&
      !report.oralLinter.hasForbiddenParentheses &&
      !report.oralLinter.hasFragmentedSentences
    : null;

  // Kịch bản cuối: ưu tiên node Chuyển thể trên nhánh của node Kiểm định đang xem.
  const checkerNodeId = useMemo(() => {
    if (!checkerStep || checkerVersion == null) return null;
    return checkerStep.versions.find((item) => item.version === checkerVersion)?.id ?? null;
  }, [checkerStep, checkerVersion]);

  const oralizerAncestor = findOralizerAncestor(tree, checkerNodeId);
  const oralizerOwner = checkerNodeId == null ? oralizerStep : undefined;
  const scriptSourceVersioned = oralizerAncestor
    ? oralizerStep?.versions.find((item) => item.id === oralizerAncestor.nodeId)
    : undefined;
  const scriptVersion = scriptSourceVersioned?.version ?? activeVersionFor(oralizerOwner ?? oralizerStep, activeVersions);
  const scriptSourceOutput = scriptSourceVersioned ?? versionNodeAt(oralizerStep, scriptVersion);
  const scriptParsed = OralizedScriptSchema.safeParse(scriptSourceOutput?.outputJson);
  const finalScript = scriptParsed.success ? scriptParsed.data : null;

  const publication = tree?.publications[tree.publications.length - 1] ?? null;
  const published = workflow?.status === "COMPLETED" && publication != null;

  const renderGateContent = (type: StepType): React.ReactNode => {
    const step = stepByType(workflow?.steps ?? [], type);
    if (!step || step.status !== "WAITING_FOR_HUMAN") return undefined;

    if (type === "RESEARCHER") {
      if (!consultation || researchVersion == null) return undefined;
      return (
        <NarrativeMenuCard
          consultation={consultation}
          activeVersion={researchVersion}
          isSubmitting={acting}
          onApprove={(selection) => handleGateZeroApprove(researchVersion, selection)}
        />
      );
    }

    if (type === "STORY_PLANNER") {
      return (
        <div className="space-y-2 rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">Nhánh thực thi</span>
            <span className="text-[11px] text-muted-foreground">
              {tree ? `${tree.nodes.length} node · ${tree.publications.length} bản xuất bản` : "chưa tải cây"}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              className="ml-auto h-7 text-xs"
              aria-label="Tải lại cây lịch sử thực thi"
            >
              <TreePine className="size-3.5" aria-hidden />
              Tải cây nhánh
            </Button>
          </div>
          {outline && (
            <p className="text-[11px] text-muted-foreground">
              Duyệt dàn ý “{outline.seriesTitle}” hoặc tạo nhánh mới nếu muốn đổi cấu trúc 3 tập.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <span className="text-xs font-semibold text-emerald-300">Bản ghi xuất bản của run</span>
          {tree && tree.publications.length > 0 ? (
            <ul className="space-y-1">
              {tree.publications.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">
                    #{item.id}
                  </Badge>
                  <span className="font-mono">node {item.approvedVersionId}</span>
                  <span className="tabular-nums">
                    {new Intl.NumberFormat("vi-VN").format(item.totalWords)} từ ·{" "}
                    {formatDuration(item.estimatedDurationSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Chưa có bản xuất bản nào. Bấm “Phê duyệt &amp; Xuất bản” bên dưới để ghi bản ghi podcast và đóng workflow.
            </p>
          )}
        </div>

        <LivePodcastPreview
          script={finalScript}
          version={scriptVersion}
          lintClean={lintClean}
          published={published}
          publicationId={publication?.id ?? null}
        />
      </div>
    );
  };

  const waitingForHuman = workflow?.status === "WAITING_FOR_HUMAN";
  const running = workflow != null && !waitingForHuman && workflow.status !== "COMPLETED" && workflow.status !== "FAILED";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight sm:text-base">Sử Ký Agent Studio</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Pipeline Podcast Lịch sử 7 tác tử · 3 trạm duyệt người (HITL)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {workflowId != null && (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1 font-mono text-xs">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    workflow?.status === "COMPLETED" && "bg-emerald-500",
                    workflow?.status === "FAILED" && "bg-red-500",
                    running && "animate-pulse bg-sky-500",
                    waitingForHuman && "animate-ping bg-amber-500"
                  )}
                  aria-hidden
                />
                Run #{workflowId} · {workflow?.status ?? "ĐANG TẢI"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>Đã xảy ra lỗi</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <Card className="border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden>📥</span> Chủ đề lịch sử đầu vào
                </CardTitle>
                <CardDescription className="text-xs">
                  Nêu sự kiện, nhân vật hoặc giai đoạn cần dựng thành series podcast 3 tập.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-1">
                <Textarea
                  rows={3}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Ví dụ: Trận Bạch Đằng năm 938…"
                  className="resize-y text-xs leading-relaxed"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{topic.trim().length} ký tự</span>
                  <Button
                    size="sm"
                    onClick={() => void handleStart()}
                    disabled={starting || topic.trim().length < 3}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Đang khởi tạo…
                      </>
                    ) : (
                      <>
                        Bắt đầu pipeline <ArrowRight className="size-3.5" aria-hidden />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tiến trình thực thi 7 bước
                </h2>
                {workflow && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Bước hiện tại: {workflow.currentStep ?? "—"}
                  </span>
                )}
              </div>

              {STEP_DEFINITIONS.map((definition) => {
                const step = workflow ? stepByType(workflow.steps, definition.type) : undefined;
                const isGate = definition.gate != null;
                return (
                  <StepCard
                    key={definition.type}
                    type={definition.type}
                    label={definition.label}
                    description={definition.description}
                    status={step?.status ?? "PENDING"}
                    reviewer={step?.reviewer ?? (isGate ? "Moderator" : "Tự động")}
                    currentVersion={step?.currentVersion ?? null}
                    approvedVersion={step?.approvedVersion ?? null}
                    activeVersion={activeVersionFor(step, activeVersions)}
                    incomingGuidance={step?.incomingGuidance}
                    errorMessage={step?.errorMessage}
                    versions={step?.versions ?? []}
                    isSubmitting={acting}
                    onSelectVersion={(version) =>
                      setActiveVersions((prev) => ({ ...prev, [definition.type]: version }))
                    }
                    onRerun={(feedback) => handleRerun(definition.type, feedback)}
                    onContinue={
                      definition.type === "STORY_PLANNER" || definition.type === "FACT_CHECKER"
                        ? (version, guidance) => handleContinue(definition.type, version, guidance)
                        : undefined
                    }
                    onDirectEdit={
                      isGate
                        ? (baseVersion, editedOutput, note) =>
                            handleDirectEdit(definition.type, baseVersion, editedOutput, note)
                        : undefined
                    }
                    continueLabel={
                      definition.type === "FACT_CHECKER" ? "Phê duyệt & Xuất bản →" : "Duyệt & Đi tiếp →"
                    }
                    gateContent={renderGateContent(definition.type)}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-5">
            <div className="flex flex-wrap items-center gap-1 border-b pb-2">
              <Button
                size="sm"
                variant={rightTab === "script" ? "default" : "outline"}
                onClick={() => setRightTab("script")}
                aria-pressed={rightTab === "script"}
                className="h-8 gap-1.5 text-xs"
              >
                <FileText className="size-3.5" aria-hidden />
                Kịch bản 3 tập
              </Button>
              <Button
                size="sm"
                variant={rightTab === "tree" ? "default" : "outline"}
                onClick={() => setRightTab("tree")}
                aria-pressed={rightTab === "tree"}
                className="h-8 gap-1.5 text-xs"
              >
                <TreePine className="size-3.5" aria-hidden />
                Cây thực thi
              </Button>
              <Button
                size="sm"
                variant={rightTab === "trace" ? "default" : "outline"}
                onClick={() => setRightTab("trace")}
                aria-pressed={rightTab === "trace"}
                className="h-8 gap-1.5 text-xs"
              >
                <Activity className="size-3.5" aria-hidden />
                Nhật ký Trace
              </Button>
              <Button
                size="sm"
                variant={rightTab === "json" ? "default" : "outline"}
                onClick={() => setRightTab("json")}
                aria-pressed={rightTab === "json"}
                className="h-8 gap-1.5 text-xs"
              >
                <Code2 className="size-3.5" aria-hidden />
                JSON
              </Button>
            </div>

            {rightTab === "script" && (
              <LivePodcastPreview
                script={finalScript}
                version={scriptVersion}
                lintClean={lintClean}
                published={published}
                publicationId={publication?.id ?? null}
              />
            )}

            {rightTab === "tree" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Cây lịch sử thực thi</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refresh()}
                    disabled={workflowId == null}
                    className="h-7 text-xs"
                  >
                    Làm mới
                  </Button>
                </div>
                <ExecutionTreeView
                  tree={tree}
                  selectedNodeIds={[
                    checkerNodeId,
                    oralizerAncestor?.nodeId ?? null,
                  ].filter((value): value is number => value != null)}
                />
              </div>
            )}

            {rightTab === "trace" && (
              <TracePanel workflowId={workflowId} workflowStatus={workflow?.status ?? null} />
            )}

            {rightTab === "json" && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <span className="block text-xs font-semibold text-muted-foreground">Workflow State Dump</span>
                <pre className="max-h-[500px] overflow-auto rounded bg-muted/60 p-3 font-mono text-[10px] text-foreground">
                  {workflow ? JSON.stringify(workflow, null, 2) : "// Chưa có workflow nào đang chạy"}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <span>Sử Ký Agent Studio · Next.js + Hono + PGlite + Pi SDK</span>
          <span>Zero external daemons · Local-first</span>
        </div>
      </footer>
    </div>
  );
}
