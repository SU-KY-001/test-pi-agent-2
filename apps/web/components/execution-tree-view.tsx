"use client";

import React from "react";
import { STEP_ORDER, type StepType, type WorkflowTreeResponse } from "@repo/contracts";
import { Badge } from "./ui/badge";
import { statusBadgeClass, statusLabel } from "@/lib/step-status";
import { cn } from "@/lib/utils";

const STEP_SHORT_LABEL: Record<StepType, string> = {
  RESEARCHER: "1. Tư vấn biên tập",
  SOURCE_EVALUATOR: "2. Thẩm định nguồn",
  FACT_EXTRACTOR: "3. Bóc tách dữ kiện",
  STORY_PLANNER: "4. Dàn ý SPDC 3 tập",
  SCRIPT_WRITER: "5. Biên kịch văn xuôi",
  ORALIZER: "6. Chuyển thể văn nói",
  FACT_CHECKER: "7. Kiểm định & chống bịa đặt",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", { hour12: false, dateStyle: "short", timeStyle: "medium" });
}

interface ExecutionTreeViewProps {
  tree: WorkflowTreeResponse | null;
  /** Node đang được chọn để xem trên dashboard (để tô nổi). */
  selectedNodeIds?: number[];
}

export function ExecutionTreeView({ tree, selectedNodeIds = [] }: ExecutionTreeViewProps) {
  if (!tree) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
        <span className="mb-2 text-xl">🌳</span>
        Chưa tải được cây lịch sử thực thi.
      </div>
    );
  }

  const nodeById = new Map(tree.nodes.map((node) => [node.id, node]));
  const selected = new Set(selectedNodeIds);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <span className="text-xs font-semibold text-foreground">
          Cây lịch sử thực thi · Run #{tree.workflowRunId}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {tree.nodes.length} node · {tree.publications.length} bản xuất bản
        </span>
      </header>

      <div className="space-y-3">
        {STEP_ORDER.map((stepType) => {
          const nodes = tree.nodes.filter((node) => node.stepType === stepType);
          if (nodes.length === 0) return null;
          return (
            <section key={stepType} className="space-y-1.5">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {STEP_SHORT_LABEL[stepType]}
              </h5>
              <ul className="space-y-1">
                {nodes.map((node) => {
                  const parent = node.parentVersionId == null ? null : nodeById.get(node.parentVersionId);
                  return (
                    <li
                      key={node.id}
                      className={cn(
                        "flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5",
                        selected.has(node.id) && "border-primary/60 bg-primary/5"
                      )}
                    >
                      <span className="font-mono text-[11px] font-semibold text-foreground">v{node.version}</span>
                      <Badge variant="outline" className={cn("text-[10px] font-normal", statusBadgeClass(node.status))}>
                        {statusLabel(node.status)}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {node.parentVersionId == null
                          ? "↳ node gốc"
                          : `↳ fork từ v${parent?.version ?? "?"} (node ${node.parentVersionId})`}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {formatTime(node.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="space-y-1.5 border-t border-border/60 pt-3">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Bản xuất bản
        </h5>
        {tree.publications.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Chưa xuất bản lần nào.</p>
        ) : (
          <ul className="space-y-1">
            {tree.publications.map((publication) => (
              <li
                key={publication.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-[11px]"
              >
                <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">
                  #{publication.id}
                </Badge>
                <span className="font-mono text-muted-foreground">node {publication.approvedVersionId}</span>
                <span className="tabular-nums text-muted-foreground">
                  {new Intl.NumberFormat("vi-VN").format(publication.totalWords)} từ ·{" "}
                  {Math.max(1, Math.round(publication.estimatedDurationSeconds / 60))} phút
                </span>
                <span className="ml-auto font-mono text-muted-foreground">
                  {formatTime(publication.publishedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
