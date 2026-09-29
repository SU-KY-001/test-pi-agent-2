"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Compass,
  FileSearch,
  Loader2,
  Megaphone,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { GetWorkflowResponse, StepStatus, StepType, WorkflowStatus } from "@repo/contracts";
import {
  approvePlanner,
  createWorkflow,
  fetchWorkflow,
  regeneratePlanner,
} from "../lib/workflow-api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TracePanel } from "@/components/trace-panel";

const DEFAULT_INPUT = `Bình giữ nhiệt 750ml.
Giữ lạnh 18 giờ, giữ nóng 10 giờ.
Vỏ inox.
Giá 299.000đ.
Đối tượng là sinh viên và dân văn phòng.`;

const POLL_INTERVAL_MS = 1500;

type StepView = GetWorkflowResponse["steps"][number];

interface PlannerOutput {
  targetAudience?: string;
  angle?: string;
  headlineDirection?: string;
  keyPoints?: string[];
  tone?: string;
}

interface AdOutput {
  headline?: string;
  body?: string;
  callToAction?: string;
}

interface ReviewOutput {
  passed?: boolean;
  issues?: { claim: string; reason: string; expectedFact: string | null }[];
}

interface ExtractorOutput {
  productName?: string;
  capacityMl?: number | null;
  features?: string[];
  coldHours?: number | null;
  hotHours?: number | null;
  material?: string | null;
  price?: number | null;
  audiences?: string[];
}

const STEP_META: { type: StepType; label: string; description: string; icon: typeof FileSearch }[] = [
  { type: "EXTRACTOR", label: "Trích xuất", description: "Bóc tách dữ kiện sản phẩm", icon: FileSearch },
  { type: "PLANNER", label: "Lập kế hoạch", description: "Chốt góc nội dung", icon: Compass },
  { type: "WRITER", label: "Viết bài", description: "Soạn quảng cáo", icon: PenLine },
  { type: "REVIEWER", label: "Kiểm chứng", description: "Đối chiếu sự thật", icon: ShieldCheck },
];

function stepByType(steps: StepView[], type: StepType): StepView | undefined {
  return steps.find((s) => s.type === type);
}

function isTerminal(status: WorkflowStatus): boolean {
  return status === "COMPLETED" || status === "FAILED";
}

function statusBadgeClass(status: StepStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "RUNNING":
    case "QUEUED":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300";
    case "WAITING_FOR_HUMAN":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function statusLabel(status: StepStatus): string {
  switch (status) {
    case "PENDING":
      return "Chờ chạy";
    case "QUEUED":
      return "Trong hàng đợi";
    case "RUNNING":
      return "Đang chạy";
    case "WAITING_FOR_HUMAN":
      return "Chờ duyệt";
    case "COMPLETED":
      return "Hoàn tất";
    case "FAILED":
      return "Thất bại";
  }
}

function StepIcon({ status, Icon }: { status: StepStatus; Icon: typeof FileSearch }) {
  if (status === "RUNNING" || status === "QUEUED") {
    return <Loader2 className="size-4 animate-spin" aria-hidden />;
  }
  if (status === "COMPLETED") return <CheckCircle2 className="size-4" aria-hidden />;
  if (status === "FAILED") return <XCircle className="size-4" aria-hidden />;
  if (status === "WAITING_FOR_HUMAN") return <Icon className="size-4" aria-hidden />;
  return <CircleDashed className="size-4" aria-hidden />;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

export default function HomePage() {
  const [rawInput, setRawInput] = useState<string>(DEFAULT_INPUT);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | undefined>(undefined);

  const stopPolling = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = undefined;
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
      setFeedback("");
      setViewVersion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const handleRegenerate = async () => {
    if (workflowId == null || !feedback.trim() || acting) return;
    setActing(true);
    setError(null);
    try {
      await regeneratePlanner(workflowId, feedback.trim());
      setFeedback("");
      const data = await fetchWorkflow(workflowId);
      setWorkflow(data);
      setViewVersion(data.steps.find((s) => s.type === "PLANNER")?.currentVersion ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async () => {
    if (workflowId == null || !workflow || acting) return;
    const planner = stepByType(workflow.steps, "PLANNER");
    if (!planner?.currentVersion) return;
    setActing(true);
    setError(null);
    try {
      await approvePlanner(workflowId, planner.currentVersion);
      setWorkflow(await fetchWorkflow(workflowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActing(false);
    }
  };

  const planner = workflow ? stepByType(workflow.steps, "PLANNER") : undefined;
  const writer = workflow ? stepByType(workflow.steps, "WRITER") : undefined;
  const reviewer = workflow ? stepByType(workflow.steps, "REVIEWER") : undefined;
  const extractor = workflow ? stepByType(workflow.steps, "EXTRACTOR") : undefined;

  const activeVersion = viewVersion ?? planner?.currentVersion ?? null;
  const plannerCurrent = planner?.versions.find((v) => v.version === activeVersion) ?? null;
  const plannerOutput = (plannerCurrent?.outputJson ?? null) as PlannerOutput | null;
  const writerCurrent = writer?.versions.find((v) => v.version === writer.currentVersion) ?? null;
  const adOutput = (writerCurrent?.outputJson ?? null) as AdOutput | null;
  const reviewerCurrent =
    reviewer?.versions.find((v) => v.version === reviewer.currentVersion) ?? null;
  const reviewOutput = (reviewerCurrent?.outputJson ?? null) as ReviewOutput | null;
  const extractorCurrent =
    extractor?.versions.find((v) => v.version === extractor.currentVersion) ?? null;
  const extractorOutput = (extractorCurrent?.outputJson ?? null) as ExtractorOutput | null;

  const needsReview = workflow?.status === "WAITING_FOR_HUMAN" && plannerCurrent != null;
  const completed = workflow?.status === "COMPLETED";
  const failed = workflow?.status === "FAILED";
  const running = workflow != null && !isTerminal(workflow.status);

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight sm:text-lg">
              Sử Ký Agent
            </h1>
            <p className="text-muted-foreground truncate text-xs">
              Quy trình AI 4 bước có con người duyệt
            </p>
          </div>
          {workflowId != null && (
            <Badge variant="outline" className="gap-1.5 font-mono">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  completed && "bg-emerald-500",
                  failed && "bg-red-500",
                  running && "animate-pulse bg-sky-500",
                  needsReview && "animate-pulse bg-amber-500"
                )}
                aria-hidden
              />
              Workflow #{workflowId}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[400px_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                  1
                </span>
                Mô tả sản phẩm
              </CardTitle>
              <CardDescription>
                Nhập gạch đầu dòng càng cụ thể, trích xuất càng chính xác.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <label htmlFor="product-input" className="text-sm font-medium">
                  Dữ liệu đầu vào
                </label>
                <Textarea
                  id="product-input"
                  rows={7}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder="Tên sản phẩm, dung tích, tính năng, giá, đối tượng…"
                  className="resize-y leading-relaxed"
                />
                <p className="text-muted-foreground text-xs">
                  {rawInput.trim().length} ký tự — tối thiểu 1 ký tự để bắt đầu.
                </p>
              </div>
              <Button onClick={handleStart} disabled={starting || !rawInput.trim()} className="w-full">
                {starting ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Đang khởi tạo…
                  </>
                ) : (
                  <>
                    Bắt đầu workflow <ArrowRight aria-hidden />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                    2
                  </span>
                  Pipeline
                </CardTitle>
                {workflow && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-[11px]", statusBadgeClass(workflow.status as StepStatus))}>
                      {workflow.status}
                    </Badge>
                    {workflow.currentStep && (
                      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                        {workflow.currentStep}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              {workflow == null && (
                <CardDescription>
                  Chưa có workflow nào đang chạy.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {workflow == null ? (
                <div className="flex flex-col gap-2">
                  {workflowId != null && (
                    <>
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <p className="text-muted-foreground text-sm">Đang tải workflow…</p>
                    </>
                  )}
                  {workflowId == null && (
                    <ol className="flex flex-col gap-2">
                      {STEP_META.map(({ type, label, description, icon: Icon }) => (
                        <li
                          key={type}
                          className="border-border text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm"
                        >
                          <Icon className="size-4 shrink-0" aria-hidden />
                          <span className="font-medium">{label}</span>
                          <span className="truncate text-xs">{description}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : (
                <ol className="flex flex-col gap-2" aria-live="polite">
                  {STEP_META.map(({ type, label, description, icon: Icon }) => {
                    const step = stepByType(workflow.steps, type);
                    const status: StepStatus = step?.status ?? "PENDING";
                    return (
                      <li
                        key={type}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200",
                          status === "RUNNING" || status === "QUEUED"
                            ? "border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/40"
                            : status === "WAITING_FOR_HUMAN"
                              ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40"
                              : "border-border"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border",
                            statusBadgeClass(status)
                          )}
                        >
                          <StepIcon status={status} Icon={Icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-medium">{label}</span>
                            <Badge variant="outline" className={cn("text-[11px]", statusBadgeClass(status))}>
                              {statusLabel(status)}
                            </Badge>
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {description}
                            {type === "PLANNER" && step?.currentVersion != null
                              ? ` · v${step.currentVersion}`
                              : ""}
                            {type === "PLANNER" && step?.approvedVersion != null
                              ? ` · đã duyệt v${step.approvedVersion}`
                              : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {extractorOutput && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Dữ kiện sản phẩm</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Sản phẩm</dt>
                    <dd className="font-medium">{extractorOutput.productName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Giá</dt>
                    <dd className="font-medium tabular-nums">{formatPrice(extractorOutput.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Dung tích</dt>
                    <dd className="font-medium tabular-nums">
                      {extractorOutput.capacityMl != null ? `${extractorOutput.capacityMl} ml` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Chất liệu</dt>
                    <dd className="font-medium">{extractorOutput.material ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Giữ lạnh / nóng</dt>
                    <dd className="font-medium tabular-nums">
                      {extractorOutput.coldHours ?? "—"}h / {extractorOutput.hotHours ?? "—"}h
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Đối tượng</dt>
                    <dd className="font-medium">{(extractorOutput.audiences ?? []).join(", ") || "—"}</dd>
                  </div>
                </dl>
                {(extractorOutput.features ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(extractorOutput.features ?? []).map((f) => (
                      <Badge key={f} variant="outline" className="font-normal">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <TracePanel workflowId={workflowId} workflowStatus={workflow?.status ?? null} />
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>Đã xảy ra lỗi</AlertTitle>
              <AlertDescription className="break-words">{error}</AlertDescription>
            </Alert>
          )}

          {needsReview && (
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-bold">
                      3
                    </span>
                    Duyệt kế hoạch nội dung
                  </CardTitle>
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    Chờ con người · v{activeVersion}
                  </Badge>
                </div>
                <CardDescription>
                  Kiểm tra góc nội dung trước khi cho Writer viết bài. Không ưng thì góp ý để tạo bản mới.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {(planner?.versions.length ?? 0) > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Các phiên bản kế hoạch">
                    <span className="text-muted-foreground mr-1 text-xs">Phiên bản:</span>
                    {planner?.versions.map((v) => (
                      <Button
                        key={v.version}
                        role="tab"
                        aria-selected={v.version === activeVersion}
                        variant={v.version === activeVersion ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewVersion(v.version)}
                      >
                        v{v.version}
                      </Button>
                    ))}
                  </div>
                )}
                {plannerOutput ? (
                  <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Đối tượng
                      </dt>
                      <dd className="mt-0.5 font-medium">{plannerOutput.targetAudience ?? "—"}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Giọng văn
                      </dt>
                      <dd className="mt-0.5">
                        <Badge variant="outline" className="font-normal">
                          {plannerOutput.tone ?? "—"}
                        </Badge>
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Góc nội dung
                      </dt>
                      <dd className="mt-0.5">{plannerOutput.angle ?? "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Định hướng tiêu đề
                      </dt>
                      <dd className="mt-0.5">{plannerOutput.headlineDirection ?? "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                        Điểm chính
                      </dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {(plannerOutput.keyPoints ?? []).map((point) => (
                          <Badge key={point} variant="outline" className="font-normal">
                            {point}
                          </Badge>
                        ))}
                        {(plannerOutput.keyPoints ?? []).length === 0 && "—"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-muted-foreground text-sm">Phiên bản này chưa có nội dung.</p>
                )}
                <Separator />
                <div className="grid gap-1.5">
                  <label htmlFor="planner-feedback" className="text-sm font-medium">
                    Góp ý để tạo bản mới <span className="text-muted-foreground font-normal">(không bắt buộc nếu duyệt luôn)</span>
                  </label>
                  <Textarea
                    id="planner-feedback"
                    rows={3}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Ví dụ: Tập trung hoàn toàn vào sinh viên, nhấn mạnh giá rẻ…"
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={acting || !feedback.trim()}
                    className="flex-1"
                  >
                    {acting ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw aria-hidden />
                    )}
                    Tạo bản mới
                  </Button>
                  <Button onClick={handleApprove} disabled={acting} className="flex-1">
                    {acting ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 aria-hidden />
                    )}
                    Duyệt & viết bài
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {running && !needsReview && (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Loader2 className="size-5 animate-spin text-sky-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium">Workflow đang chạy…</p>
                  <p className="text-muted-foreground text-sm">
                    Trạng thái tự cập nhật mỗi {POLL_INTERVAL_MS / 1000}s. Bạn có thể theo dõi pipeline bên trái.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {completed && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      <CheckCircle2 className="size-4" aria-hidden />
                    </span>
                    Thành phẩm quảng cáo
                  </CardTitle>
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    Writer ✓ · Reviewer ✓ · Planner v{planner?.approvedVersion} đã duyệt
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {adOutput ? (
                  <article className="overflow-hidden rounded-xl border">
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-8 text-white">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-widest text-slate-300 uppercase">
                        <Megaphone className="size-3.5" aria-hidden /> Quảng cáo
                      </p>
                      <h2 className="text-xl leading-snug font-bold text-balance sm:text-2xl">
                        {adOutput.headline}
                      </h2>
                    </div>
                    <div className="flex flex-col gap-4 px-6 py-5">
                      <p className="text-[15px] leading-relaxed text-pretty">{adOutput.body}</p>
                      {adOutput.callToAction && (
                        <div>
                          <Button size="lg">
                            {adOutput.callToAction} <ArrowRight aria-hidden />
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ) : (
                  <p className="text-muted-foreground text-sm">Chưa có nội dung quảng cáo.</p>
                )}

                {reviewOutput && (
                  <div
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm",
                      reviewOutput.passed
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                    )}
                    role="status"
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      <ShieldCheck className="size-4" aria-hidden />
                      Kiểm chứng: {reviewOutput.passed ? "ĐẠT — khớp sự thật gốc" : "KHÔNG ĐẠT — có điểm sai lệch"}
                    </p>
                    {!reviewOutput.passed && (reviewOutput.issues ?? []).length > 0 && (
                      <ul className="flex list-disc flex-col gap-1 pl-5">
                        {(reviewOutput.issues ?? []).map((issue, i) => (
                          <li key={i}>
                            <span className="font-medium">{issue.claim}</span> — {issue.reason}
                            {issue.expectedFact ? ` (đúng ra: ${issue.expectedFact})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {failed && (
            <Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <XCircle className="size-4" aria-hidden />
              <AlertTitle>Workflow thất bại</AlertTitle>
              <AlertDescription>
                {workflow?.steps.find((s) => s.status === "FAILED")?.errorMessage ??
                  "Một bước trong pipeline gặp lỗi. Hãy thử lại với mô tả khác."}
              </AlertDescription>
            </Alert>
          )}

          {workflow == null && workflowId == null && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="bg-muted flex size-11 items-center justify-center rounded-full">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <p className="font-medium">Chưa có kết quả nào</p>
                <p className="text-muted-foreground max-w-sm text-sm">
                  Nhập mô tả sản phẩm ở cột trái rồi bấm “Bắt đầu workflow”. Pipeline sẽ chạy trích xuất →
                  lập kế hoạch → chờ bạn duyệt → viết bài → kiểm chứng.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-4 text-xs sm:px-6">
          <span>Su Ky Agent Demo · Next.js + Hono + PGlite + Pi SDK</span>
          <span aria-hidden>·</span>
          <span>Font Inter · shadcn/ui · Lucide icons</span>
        </div>
      </footer>
    </div>
  );
}
