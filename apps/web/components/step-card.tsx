"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Compass,
  FileSearch,
  Loader2,
  PenLine,
  ShieldCheck,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { StepStatus, StepType, StepVersion } from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ActionDeck } from "./action-deck";

export interface StepCardProps {
  type: StepType;
  label: string;
  description: string;
  status: StepStatus;
  currentVersion: number | null;
  approvedVersion: number | null;
  incomingGuidance?: string | null;
  errorMessage?: string | null;
  versions: StepVersion[];
  isSubmitting?: boolean;
  onRerun?: (feedback: string) => Promise<void>;
  onContinue?: (version: number, guidance?: string) => Promise<void>;
  onDirectEdit?: (baseVersion: number, editedOutput: unknown, note?: string) => Promise<void>;
}

const STEP_ICONS: Record<StepType, typeof FileSearch> = {
  EXTRACTOR: FileSearch,
  PLANNER: Compass,
  WRITER: PenLine,
  REVIEWER: ShieldCheck,
};

function statusBadgeClass(status: StepStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "RUNNING":
    case "QUEUED":
      return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300";
    case "WAITING_FOR_HUMAN":
      return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse";
    case "FAILED":
      return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
    case "STALE":
      return "border-zinc-300 bg-zinc-100 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
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
      return "Đang chạy…";
    case "WAITING_FOR_HUMAN":
      return "Chờ bạn duyệt";
    case "COMPLETED":
      return "Hoàn tất";
    case "FAILED":
      return "Thất bại";
    case "STALE":
      return "Đã cũ (hủy)";
  }
}

function StepStatusIcon({ status, Icon }: { status: StepStatus; Icon: typeof FileSearch }) {
  if (status === "RUNNING" || status === "QUEUED") {
    return <Loader2 className="size-4 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />;
  }
  if (status === "COMPLETED") {
    return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "FAILED") {
    return <XCircle className="size-4 text-red-600 dark:text-red-400" aria-hidden />;
  }
  if (status === "WAITING_FOR_HUMAN") {
    return <span className="size-2.5 rounded-full bg-amber-500 animate-ping" aria-hidden />;
  }
  if (status === "STALE") {
    return <span className="size-2 rounded-full bg-zinc-400" aria-hidden />;
  }
  return <CircleDashed className="size-4 text-muted-foreground" aria-hidden />;
}

export function StepCard({
  type,
  label,
  description,
  status,
  currentVersion,
  approvedVersion,
  incomingGuidance,
  errorMessage,
  versions,
  isSubmitting = false,
  onRerun,
  onContinue,
  onDirectEdit,
}: StepCardProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const Icon = STEP_ICONS[type] || FileSearch;
  const activeVersion = selectedVersion ?? currentVersion ?? (versions.length > 0 ? versions[versions.length - 1]?.version ?? null : null);
  const activeVersionData = versions.find((v) => v.version === activeVersion);
  const output = activeVersionData?.outputJson as Record<string, unknown> | null;

  return (
    <Card
      className={cn(
        "transition-all duration-200 border",
        status === "RUNNING" && "border-sky-300 dark:border-sky-800 shadow-xs",
        status === "WAITING_FOR_HUMAN" && "border-amber-400 dark:border-amber-700 shadow-md ring-1 ring-amber-400/30",
        status === "STALE" && "opacity-60 bg-muted/20 border-dashed"
      )}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                statusBadgeClass(status)
              )}
            >
              <StepStatusIcon status={status} Icon={Icon} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight">{label}</CardTitle>
                <Badge variant="outline" className={cn("text-[11px] font-normal", statusBadgeClass(status))}>
                  {statusLabel(status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {currentVersion != null && (
              <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                v{currentVersion}
              </span>
            )}
            {approvedVersion != null && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Đã duyệt v{approvedVersion}
              </span>
            )}
          </div>
        </div>

        {/* Incoming guidance banner */}
        {incomingGuidance && (
          <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary flex items-start gap-2">
            <span className="text-sm">💡</span>
            <div>
              <span className="font-semibold">Lời dặn từ bước trước: </span>
              <span className="italic">{incomingGuidance}</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-2.5 rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/60 p-2.5 text-xs text-red-700 dark:text-red-300">
            ⚠️ {errorMessage}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {/* Version Switcher Tabs */}
        {versions.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
            <span className="text-[11px] text-muted-foreground font-medium">Phiên bản:</span>
            {versions.map((v) => (
              <Button
                key={v.version}
                size="sm"
                variant={v.version === activeVersion ? "default" : "outline"}
                onClick={() => setSelectedVersion(v.version)}
                className="h-6 px-2 text-xs font-mono"
              >
                v{v.version}
              </Button>
            ))}
          </div>
        )}

        {/* Output Visualization by StepType */}
        {output && (
          <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-xs space-y-2">
            {type === "EXTRACTOR" && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Tên sản phẩm</dt>
                  <dd className="font-medium text-foreground">{String(output.productName ?? "—")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Giá</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {output.price != null
                      ? `${new Intl.NumberFormat("vi-VN").format(Number(output.price))}đ`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Dung tích</dt>
                  <dd className="font-medium text-foreground">
                    {output.capacityMl != null ? `${output.capacityMl} ml` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Chất liệu</dt>
                  <dd className="font-medium text-foreground">{String(output.material ?? "—")}</dd>
                </div>
                {Array.isArray(output.features) && output.features.length > 0 && (
                  <div className="col-span-2 pt-1">
                    <dt className="text-muted-foreground mb-1">Tính năng chính</dt>
                    <dd className="flex flex-wrap gap-1">
                      {output.features.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-[11px] font-normal">
                          {String(f)}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {type === "PLANNER" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Đối tượng</span>
                    <span className="font-medium text-foreground">{String(output.targetAudience ?? "—")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Giọng điệu</span>
                    <Badge variant="outline" className="text-[11px] font-normal capitalize">
                      {String(output.tone ?? "—")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Góc tiếp cận</span>
                  <p className="font-medium text-foreground">{String(output.angle ?? "—")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Định hướng tiêu đề</span>
                  <p className="font-medium text-foreground">{String(output.headlineDirection ?? "—")}</p>
                </div>
                {Array.isArray(output.keyPoints) && output.keyPoints.length > 0 && (
                  <div>
                    <span className="text-muted-foreground block text-[11px] mb-1">Luận điểm then chốt</span>
                    <div className="flex flex-wrap gap-1">
                      {output.keyPoints.map((pt, i) => (
                        <Badge key={i} variant="outline" className="text-[11px] font-normal">
                          {String(pt)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {type === "WRITER" && (
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Tiêu đề quảng cáo</span>
                  <h4 className="font-bold text-foreground text-sm">{String(output.headline ?? "—")}</h4>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Nội dung</span>
                  <p className="text-muted-foreground whitespace-pre-line line-clamp-3">
                    {String(output.body ?? "—")}
                  </p>
                </div>
                {Boolean(output.callToAction) && (
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Kêu gọi hành động (CTA)</span>
                    <span className="font-semibold text-primary">{String(output.callToAction)}</span>
                  </div>
                )}
              </div>
            )}

            {type === "REVIEWER" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Kết quả kiểm chứng:</span>
                  {output.passed ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                      ✓ ĐẠT — Đúng sự thật
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                      ✗ KHÔNG ĐẠT — Có lỗi sai lệch
                    </Badge>
                  )}
                </div>
                {Array.isArray(output.issues) && output.issues.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] font-semibold text-red-600 block">
                      Các điểm sai lệch phát hiện:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
                      {output.issues.map((issue: Record<string, unknown>, idx: number) => (
                        <li key={idx}>
                          <span className="font-medium text-foreground">{String(issue.claim)}</span>:{" "}
                          {String(issue.reason)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Review Action Deck when step needs human decision */}
        {status === "WAITING_FOR_HUMAN" && activeVersion != null && onRerun && onContinue && (
          <ActionDeck
            stepType={type}
            currentVersion={activeVersion}
            currentOutputJson={output}
            onRerun={onRerun}
            onContinue={onContinue}
            onDirectEdit={onDirectEdit}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Collapsible Raw JSON Viewer */}
        {output && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRawJson ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              <span>{showRawJson ? "Ẩn JSON chi tiết" : "Xem JSON chi tiết"}</span>
            </button>
            {showRawJson && (
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/60 p-2.5 font-mono text-[10px] text-foreground">
                {JSON.stringify(output, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
