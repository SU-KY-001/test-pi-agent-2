"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { GetWorkflowEventsResponse, WorkflowEvent, WorkflowStatus } from "@repo/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWorkflowEvents, subscribeWorkflowEvents } from "../lib/workflow-api";
import { cn } from "@/lib/utils";

const EVENT_PAGE_SIZE = 200;
const MAX_RENDERED_EVENTS = 500;

function isTerminal(status: WorkflowStatus): boolean {
  return status === "COMPLETED" || status === "FAILED";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("vi-VN", { hour12: false });
}

interface EventMetadata {
  role?: string;
  stepType?: string;
  attempt?: number;
  length?: number;
  toolName?: string;
}

function parseMeta(e: WorkflowEvent): EventMetadata {
  if (e.metadataJson && typeof e.metadataJson === "object") {
    return e.metadataJson as EventMetadata;
  }
  return {};
}

interface ItemVisual {
  agentName?: string;
  badgeLabel: string;
  badgeTone: "sky" | "emerald" | "amber" | "rose" | "muted";
  headline: string;
  detailBody?: string;
  isJson: boolean;
}

function classify(e: WorkflowEvent): ItemVisual {
  const meta = parseMeta(e);
  const type = e.type;

  let agentName: string | undefined;
  if (type.startsWith("pi.")) {
    agentName = type.split(".")[1]?.toUpperCase();
  } else if (type.includes(".")) {
    const f = type.split(".")[0];
    if (["extractor", "planner", "writer", "reviewer"].includes(f)) {
      agentName = f.toUpperCase();
    }
  }

  // 1. Workflow khởi tạo
  if (type === "workflow.created") {
    return {
      badgeLabel: "Khởi tạo",
      badgeTone: "sky",
      headline: e.message,
      isJson: false,
    };
  }

  // 2. Bắt đầu bước
  if (type.endsWith(".started") && !type.startsWith("pi.")) {
    return {
      agentName,
      badgeLabel: "Bắt đầu",
      badgeTone: "sky",
      headline: `Bắt đầu ${agentName ?? ""}`,
      isJson: false,
    };
  }

  // 3. Hoàn tất bước
  if (type.endsWith(".completed")) {
    return {
      agentName,
      badgeLabel: "Xong",
      badgeTone: "emerald",
      headline: `Hoàn tất ${agentName ?? ""}`,
      isJson: false,
    };
  }

  // 4. Lỗi
  if (type.endsWith(".failed") || type.includes("error")) {
    return {
      agentName,
      badgeLabel: "Lỗi",
      badgeTone: "rose",
      headline: `Thất bại: ${e.message}`,
      detailBody: e.message,
      isJson: false,
    };
  }

  // 5. System prompt
  if (type.includes("system")) {
    return {
      agentName,
      badgeLabel: "System",
      badgeTone: "muted",
      headline: "Đã nạp chỉ dẫn hệ thống",
      isJson: false,
    };
  }

  // 6. User prompt
  if (type.includes(".message.") && (meta.role === "user" || type.includes("user"))) {
    return {
      agentName,
      badgeLabel: "Prompt",
      badgeTone: "amber",
      headline: "Yêu cầu gửi Pi",
      detailBody: e.message,
      isJson: false,
    };
  }

  // 7. Assistant output
  if (type.includes(".message.") && (meta.role === "assistant" || type.includes("assistant"))) {
    if (type.endsWith(".started")) {
      return {
        agentName,
        badgeLabel: "Đang nghĩ",
        badgeTone: "sky",
        headline: "Pi đang xử lý…",
        isJson: false,
      };
    }
    const isJson = e.message.trim().startsWith("{") || e.message.trim().startsWith("[");
    return {
      agentName,
      badgeLabel: "Kết quả",
      badgeTone: "emerald",
      headline: `Pi hoàn tất (${meta.length ?? e.message.length} ký tự)`,
      detailBody: e.message,
      isJson,
    };
  }

  // Fallback
  const isJson = e.message.trim().startsWith("{") || e.message.trim().startsWith("[");
  return {
    agentName,
    badgeLabel: "Log",
    badgeTone: "muted",
    headline: e.message,
    detailBody: e.message.length > 80 ? e.message : undefined,
    isJson,
  };
}

function mergeEvents(existing: WorkflowEvent[], incoming: WorkflowEvent[]): WorkflowEvent[] {
  const seen = new Set(existing.map((e) => e.id));
  const merged = [...existing];
  for (const e of incoming) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      merged.push(e);
    }
  }
  merged.sort((a, b) => a.id - b.id);
  return merged.slice(-MAX_RENDERED_EVENTS);
}

interface TracePanelProps {
  workflowId: number | null;
  workflowStatus?: WorkflowStatus | null;
}

export function TracePanel({ workflowId, workflowStatus }: TracePanelProps) {
  const [open, setOpen] = useState(true);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streamState, setStreamState] = useState<"idle" | "live" | "done">("idle");
  const [filterMode, setFilterMode] = useState<"clean" | "all">("clean");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const closeRef = useRef<(() => void) | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeStream = useCallback(() => {
    closeRef.current?.();
    closeRef.current = undefined;
  }, []);

  const loadSnapshot = useCallback(async () => {
    if (workflowId == null) return;
    try {
      const snap: GetWorkflowEventsResponse = await fetchWorkflowEvents(workflowId, EVENT_PAGE_SIZE);
      setEvents(mergeEvents([], snap.events));
      setTotal(snap.count);
    } catch {
      // non-critical
    }
  }, [workflowId]);

  const loadWithSpinner = useCallback(async () => {
    if (workflowId == null) return;
    setLoading(true);
    await loadSnapshot();
    setLoading(false);
  }, [loadSnapshot, workflowId]);

  useEffect(() => {
    closeStream();
    setStreamState("idle");
    if (!open || workflowId == null) return;

    let cancelled = false;
    setStreamState("live");

    const start = async () => {
      try {
        const snap = await fetchWorkflowEvents(workflowId, EVENT_PAGE_SIZE);
        if (cancelled) return;
        setEvents(snap.events);
        setTotal(snap.count);

        const lastId = snap.events.length > 0 ? snap.events[snap.events.length - 1]!.id : 0;
        closeRef.current = subscribeWorkflowEvents(
          workflowId,
          {
            onEvent: (e) => {
              setEvents((prev) => mergeEvents(prev, [e]));
              setTotal((t) => t + 1);
            },
            onDone: () => setStreamState("done"),
            onError: () => {},
          },
          lastId
        );
      } catch {
        // silent
      }
    };

    void start();
    return () => {
      cancelled = true;
      closeStream();
    };
  }, [open, workflowId, closeStream]);

  useEffect(() => {
    if (streamState === "done") closeStream();
  }, [streamState, closeStream]);

  useEffect(() => {
    if (workflowStatus != null && isTerminal(workflowStatus)) {
      closeStream();
      if (open) setStreamState("done");
    }
  }, [workflowStatus, open, closeStream]);

  useEffect(() => {
    setEvents([]);
    setTotal(0);
    setStreamState("idle");
    setExpandedIds(new Set());
    if (workflowId != null) setOpen(true);
  }, [workflowId]);

  useEffect(() => {
    const el = listRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [total, open]);

  // Clean mode: bỏ các lượt ping started và system log
  const visibleEvents = useMemo(() => {
    if (filterMode === "all") return events;
    return events.filter((e) => {
      const type = e.type;
      if (type.endsWith(".turn.started") || type.endsWith(".turn.ended")) return false;
      if (type.includes(".message.started")) return false;
      if (type.includes("system") || e.message.includes("(system)")) return false;
      return true;
    });
  }, [events, filterMode]);

  const running = workflowStatus != null && !isTerminal(workflowStatus);

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <Activity className="size-4 text-muted-foreground" aria-hidden />
            Nhật ký thực thi Pi
          </CardTitle>
          {total > 0 && (
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              ({visibleEvents.length}/{total})
            </span>
          )}
          {streamState === "live" && open && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          )}
          <span className="flex-1" />

          {/* Filter Mode Toggle */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("clean")}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                filterMode === "clean"
                  ? "bg-background text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Gọn gàng
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                filterMode === "all"
                  ? "bg-background text-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Toàn bộ
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
          >
            {open ? "Thu gọn" : "Mở rộng"}
            <ChevronDown className={cn("ml-1 size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </Button>
        </div>
        <CardDescription className="text-xs">
          {workflowId == null
            ? "Chưa có workflow đang chạy. Nhập mô tả sản phẩm rồi bấm bắt đầu."
            : "Luồng agent, prompt và JSON output theo thời gian thực."}
        </CardDescription>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-2 pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {running && streamState === "live"
                ? "Đang stream dữ liệu realtime…"
                : total > 0
                  ? "Bấm vào từng sự kiện để xem chi tiết"
                  : ""}
            </span>
            <button
              type="button"
              onClick={() => void loadWithSpinner()}
              disabled={loading || workflowId == null}
              className="hover:text-foreground text-xs text-muted-foreground transition-colors disabled:opacity-40"
            >
              {loading ? "Đang tải…" : "Làm mới"}
            </button>
          </div>

          {total === 0 && events.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl bg-muted/20 py-8 text-center text-xs text-muted-foreground">
              <Sparkles className="mb-1.5 size-4 opacity-40" />
              <span>Chưa có sự kiện nào cho workflow này.</span>
            </div>
          )}

          {visibleEvents.length > 0 && (
            <div
              ref={listRef}
              className="flex max-h-[420px] flex-col divide-y divide-border/30 overflow-y-auto rounded-xl bg-muted/20"
              aria-live="polite"
            >
              {visibleEvents.map((e) => {
                const visual = classify(e);
                const hasBody = Boolean(visual.detailBody);
                const isExpanded = expandedIds.has(e.id);

                return (
                  <div
                    key={e.id}
                    className={cn(
                      "px-3.5 py-2.5 transition-colors",
                      hasBody && "cursor-pointer hover:bg-muted/40"
                    )}
                    onClick={() => hasBody && toggleExpand(e.id)}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Time */}
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80">
                        {formatTime(e.createdAt)}
                      </span>

                      {/* Agent Tag */}
                      {visual.agentName && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {visual.agentName}
                        </span>
                      )}

                      {/* Status pill subtle */}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          visual.badgeTone === "emerald" && "bg-emerald-500/10 text-emerald-400",
                          visual.badgeTone === "sky" && "bg-sky-500/10 text-sky-400",
                          visual.badgeTone === "amber" && "bg-amber-500/10 text-amber-400",
                          visual.badgeTone === "rose" && "bg-rose-500/10 text-rose-400",
                          visual.badgeTone === "muted" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {visual.badgeLabel}
                      </span>

                      {/* Headline text */}
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
                        {visual.headline}
                      </span>

                      {hasBody && (
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground/60 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                          aria-hidden
                        />
                      )}
                    </div>

                    {hasBody && isExpanded && visual.detailBody && (
                      <div className="mt-2.5">
                        {visual.isJson ? (
                          <pre className="max-h-60 overflow-x-auto rounded-lg bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(visual.detailBody), null, 2);
                              } catch {
                                return visual.detailBody;
                              }
                            })()}
                          </pre>
                        ) : (
                          <div className="rounded-lg bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                            {visual.detailBody}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
