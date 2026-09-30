"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Code2,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import type {
  Advertisement,
  ContentPlan,
  GetWorkflowResponse,
  StepType,
  WorkflowStatus,
} from "@repo/contracts";
import {
  continueStep,
  createWorkflow,
  directEditStep,
  fetchWorkflow,
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
import { LiveAdPreview } from "@/components/live-ad-preview";

const DEFAULT_INPUT = `Bình giữ nhiệt 750ml.
Giữ lạnh 18 giờ, giữ nóng 10 giờ.
Vỏ inox.
Giá 299.000đ.
Đối tượng là sinh viên và dân văn phòng.`;

const POLL_INTERVAL_MS = 1500;

type StepView = GetWorkflowResponse["steps"][number];

const STEP_DEFINITIONS: { type: StepType; label: string; description: string }[] = [
  { type: "EXTRACTOR", label: "1. Trích xuất dữ kiện", description: "Bóc tách thông số sản phẩm từ văn bản thô" },
  { type: "PLANNER", label: "2. Lập kế hoạch nội dung", description: "Chốt đối tượng, góc tiếp cận & định hướng tiêu đề" },
  { type: "WRITER", label: "3. Soạn bài quảng cáo", description: "Viết tiêu đề, nội dung và lời kêu gọi hành động (CTA)" },
  { type: "REVIEWER", label: "4. Kiểm chứng sự thật", description: "Đối chiếu nội dung quảng cáo với dữ kiện sản phẩm gốc" },
];

function stepByType(steps: StepView[], type: StepType): StepView | undefined {
  return steps.find((s) => s.type === type);
}

function isTerminal(status: WorkflowStatus): boolean {
  return status === "COMPLETED" || status === "FAILED";
}

export default function HomePage() {
  const [rawInput, setRawInput] = useState<string>(DEFAULT_INPUT);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"preview" | "trace" | "json">("preview");
  const pollRef = useRef<number | undefined>(undefined);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== undefined) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (workflowId == null) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchWorkflow(workflowId);
        if (cancelled) return;
        setWorkflow(data);
        if (isTerminal(data.status)) stopPolling();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };
    void poll();
    stopPolling();
    pollRef.current = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [workflowId, stopPolling]);

  const handleStart = async () => {
    if (!rawInput.trim() || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await createWorkflow(rawInput.trim());
      stopPolling();
      setWorkflowId(res.id);
      setWorkflow(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleRerun = async (stepType: StepType, feedback: string) => {
    if (workflowId == null || acting) return;
    setActing(true);
    setError(null);
    try {
      await rerunStep(workflowId, stepType, feedback);
      const data = await fetchWorkflow(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const handleContinue = async (stepType: StepType, version: number, guidance?: string) => {
    if (workflowId == null || acting) return;
    setActing(true);
    setError(null);
    try {
      await continueStep(workflowId, stepType, version, guidance);
      const data = await fetchWorkflow(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const handleDirectEdit = async (
    stepType: StepType,
    baseVersion: number,
    editedOutput: unknown,
    note?: string
  ) => {
    if (workflowId == null || acting) return;
    setActing(true);
    setError(null);
    try {
      await directEditStep(workflowId, stepType, baseVersion, editedOutput, note);
      const data = await fetchWorkflow(workflowId);
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  // Find step outputs
  const planner = workflow ? stepByType(workflow.steps, "PLANNER") : undefined;
  const writer = workflow ? stepByType(workflow.steps, "WRITER") : undefined;

  const plannerActiveVersion = planner?.approvedVersion ?? planner?.currentVersion ?? null;
  const plannerOutput = (planner?.versions.find((v) => v.version === plannerActiveVersion)
    ?.outputJson ?? null) as ContentPlan | null;

  const writerActiveVersion = writer?.approvedVersion ?? writer?.currentVersion ?? null;
  const writerOutput = (writer?.versions.find((v) => v.version === writerActiveVersion)
    ?.outputJson ?? null) as Advertisement | null;

  const completed = workflow?.status === "COMPLETED";
  const failed = workflow?.status === "FAILED";
  const waitingForHuman = workflow?.status === "WAITING_FOR_HUMAN";
  const running = workflow != null && !isTerminal(workflow.status) && !waitingForHuman;

  return (
    <div className="bg-background min-h-dvh flex flex-col">
      {/* Top Header */}
      <header className="border-b sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg shadow-xs">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">
                Sử Ký Agent Studio
              </h1>
              <p className="text-muted-foreground text-xs hidden sm:block">
                Quy trình sáng tạo quảng cáo đa tác tử có con người đồng hành (HITL)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {workflowId != null && (
              <Badge variant="outline" className="gap-1.5 font-mono text-xs py-1 px-2.5">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    completed && "bg-emerald-500",
                    failed && "bg-red-500",
                    running && "animate-pulse bg-sky-500",
                    waitingForHuman && "animate-ping bg-amber-500"
                  )}
                  aria-hidden
                />
                Run #{workflowId} · {workflow?.status ?? "LOADING"}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Split View Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {error && (
          <Alert variant="destructive" className="mb-6 border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>Đã xảy ra lỗi</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (60% / col-span-7): Interactive Stepper */}
          <div className="lg:col-span-7 space-y-5">
            {/* Input Card */}
            <Card className="border shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span>📥</span> Thông tin sản phẩm đầu vào
                </CardTitle>
                <CardDescription className="text-xs">
                  Cung cấp thông tin sản phẩm để các Agent bóc tách và sản xuất bài quảng cáo.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-3">
                <Textarea
                  rows={4}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Nhập thông tin sản phẩm..."
                  className="resize-y text-xs leading-relaxed"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {rawInput.trim().length} ký tự
                  </span>
                  <Button
                    size="sm"
                    onClick={handleStart}
                    disabled={starting || !rawInput.trim()}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {starting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Đang khởi tạo…
                      </>
                    ) : (
                      <>
                        Bắt đầu workflow <ArrowRight className="size-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stepper Pipeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tiến trình thực thi 4 bước
                </h2>
                {workflow && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Bước hiện tại: {workflow.currentStep ?? "COMPLETED"}
                  </span>
                )}
              </div>

              {STEP_DEFINITIONS.map(({ type, label, description }) => {
                const step = workflow ? stepByType(workflow.steps, type) : undefined;
                return (
                  <StepCard
                    key={type}
                    type={type}
                    label={label}
                    description={description}
                    status={step?.status ?? "PENDING"}
                    currentVersion={step?.currentVersion ?? null}
                    approvedVersion={step?.approvedVersion ?? null}
                    incomingGuidance={step?.incomingGuidance}
                    errorMessage={step?.errorMessage}
                    versions={step?.versions ?? []}
                    isSubmitting={acting}
                    onRerun={(feedback) => handleRerun(type, feedback)}
                    onContinue={(version, guidance) => handleContinue(type, version, guidance)}
                    onDirectEdit={(baseVersion, editedOutput, note) =>
                      handleDirectEdit(type, baseVersion, editedOutput, note)
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Right Column (40% / col-span-5): Sticky Inspector & Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            {/* Tab Controller */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={rightTab === "preview" ? "default" : "outline"}
                  onClick={() => setRightTab("preview")}
                  className="h-8 text-xs gap-1.5"
                >
                  <FileText className="size-3.5" />
                  <span>Bản xem trước</span>
                </Button>
                <Button
                  size="sm"
                  variant={rightTab === "trace" ? "default" : "outline"}
                  onClick={() => setRightTab("trace")}
                  className="h-8 text-xs gap-1.5"
                >
                  <Activity className="size-3.5" />
                  <span>Nhật ký Trace</span>
                </Button>
                <Button
                  size="sm"
                  variant={rightTab === "json" ? "default" : "outline"}
                  onClick={() => setRightTab("json")}
                  className="h-8 text-xs gap-1.5"
                >
                  <Code2 className="size-3.5" />
                  <span>JSON</span>
                </Button>
              </div>
            </div>

            {/* Right Tab Content */}
            {rightTab === "preview" && (
              <LiveAdPreview
                ad={writerOutput}
                plan={plannerOutput}
                version={writerActiveVersion}
              />
            )}

            {rightTab === "trace" && (
              <TracePanel
                workflowId={workflowId}
                workflowStatus={workflow?.status ?? null}
              />
            )}

            {rightTab === "json" && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <span className="text-xs font-semibold text-muted-foreground block">
                  Workflow State Dump
                </span>
                <pre className="max-h-[500px] overflow-auto rounded bg-muted/60 p-3 font-mono text-[10px] text-foreground">
                  {workflow ? JSON.stringify(workflow, null, 2) : "// Chưa có workflow nào đang chạy"}
                </pre>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs sm:px-6">
          <span>Sử Ký Agent Studio · Next.js + Hono + PGlite + Pi SDK</span>
          <span>Zero external daemons · Local-first</span>
        </div>
      </footer>
    </div>
  );
}
