"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Minus,
  Plus,
  Radio,
  Sparkles,
  TreePine,
} from "lucide-react";
import { STEP_ORDER, type StepType, type WorkflowTreeResponse } from "@repo/contracts";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
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
  return date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface TreeNode {
  id: number;
  stepType: StepType;
  version: number;
  parentVersionId: number | null;
  status: WorkflowTreeResponse["nodes"][number]["status"];
  approved: boolean;
  createdAt: string;
  children: TreeNode[];
}

interface ExecutionTreeViewProps {
  tree: WorkflowTreeResponse | null;
  /** Node đang được chọn để xem trên dashboard (để tô nổi). */
  selectedNodeIds?: number[];
}

/** Dựng cây phân cấp từ danh sách phẳng dựa trên parentVersionId */
function buildTreeHierarchy(nodes: WorkflowTreeResponse["nodes"]): TreeNode[] {
  const nodeMap = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  // Tạo map các node
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, children: [] });
  }

  // Gán quan hệ cha-con
  for (const n of nodes) {
    const current = nodeMap.get(n.id)!;
    if (n.parentVersionId == null || !nodeMap.has(n.parentVersionId)) {
      roots.push(current);
    } else {
      const parent = nodeMap.get(n.parentVersionId)!;
      parent.children.push(current);
    }
  }

  // Sắp xếp các node con theo id / thời gian tạo
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.id - b.id);
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  return roots;
}

export function ExecutionTreeView({ tree, selectedNodeIds = [] }: ExecutionTreeViewProps) {
  const selected = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  // Dựng cấu trúc cây
  const rootNodes = useMemo(() => {
    if (!tree) return [];
    return buildTreeHierarchy(tree.nodes);
  }, [tree]);

  // Map ấn bản xuất bản theo approvedVersionId
  const pubByVersionId = useMemo(() => {
    if (!tree) return new Map();
    return new Map(tree.publications.map((p) => [p.approvedVersionId, p]));
  }, [tree]);

  // Trạng thái mở rộng của các node: mặc định mở toàn bộ
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    if (!tree) return new Set();
    return new Set(tree.nodes.map((n) => n.id));
  });

  if (!tree) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
        <TreePine className="mb-2 size-8 text-muted-foreground/50" aria-hidden />
        <span>Chưa tải được cây lịch sử thực thi.</span>
      </div>
    );
  }

  const toggleNode = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(tree.nodes.map((n) => n.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  /** Render đệ quy từng node dạng JSON tree với nút '+' */
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selected.has(node.id);
    const publication = pubByVersionId.get(node.id);

    return (
      <li key={node.id} className="relative select-none text-[11px]">
        {/* Hàng thông tin Node */}
        <div
          className={cn(
            "group flex flex-wrap items-center gap-1.5 rounded border border-transparent px-1.5 py-0.5 transition-colors hover:border-border/60 hover:bg-muted/40",
            isSelected && "border-primary/50 bg-primary/5 text-primary"
          )}
        >
          {/* Nút toggle '+' / '-' dạng JSON collapse */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(node.id)}
              aria-label={isExpanded ? `Thu gọn node ${node.id}` : `Mở rộng node ${node.id}`}
              className="flex size-3.5 shrink-0 items-center justify-center rounded border border-border/80 bg-background font-mono text-[9px] font-bold leading-none text-muted-foreground shadow-2xs hover:border-foreground/50 hover:bg-muted hover:text-foreground transition-all"
            >
              {isExpanded ? "−" : "+"}
            </button>
          ) : (
            <span
              className="flex size-3.5 shrink-0 items-center justify-center font-mono text-[9px] text-muted-foreground/40 leading-none"
              aria-hidden
            >
              •
            </span>
          )}

          {/* Nhãn bước */}
          <span className="font-semibold text-foreground">
            {STEP_SHORT_LABEL[node.stepType] ?? node.stepType}
          </span>

          {/* Số phiên bản */}
          <span className="rounded bg-muted px-1 py-0.2 font-mono text-[10px] font-bold text-foreground">
            v{node.version}
          </span>

          {/* Node ID */}
          <span className="font-mono text-[10px] text-muted-foreground">
            #{node.id}
          </span>

          {/* Trạng thái */}
          <Badge
            variant="outline"
            className={cn("text-[9px] font-normal py-0 px-1 leading-tight", statusBadgeClass(node.status))}
          >
            {statusLabel(node.status)}
          </Badge>

          {/* Huy hiệu Đã duyệt */}
          {node.approved && (
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] gap-0.5 py-0 px-1 leading-tight"
            >
              <Check className="size-2.5" />
              <span>Đã duyệt</span>
            </Badge>
          )}

          {/* Huy hiệu xuất bản */}
          {publication && (
            <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[9px] text-emerald-600 dark:text-emerald-300 py-0 px-1 leading-tight">
              Xuất bản #{publication.id}
            </Badge>
          )}

          {/* Nhãn fork */}
          {node.parentVersionId != null && (
            <span className="font-mono text-[10px] text-muted-foreground">
              (fork #{node.parentVersionId})
            </span>
          )}

          {/* Nếu đang đóng mà có con: hiển thị số nhánh con để người dùng nhận biết */}
          {!isExpanded && hasChildren && (
            <span className="rounded-full bg-muted/80 px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
              {node.children.length} nhánh
            </span>
          )}

          {/* Thời gian */}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground tabular-nums">
            {formatTime(node.createdAt)}
          </span>
        </div>

        {/* Cấp con lồng nhau có đường dẫn nhánh nhỏ gọn (border-l) */}
        {hasChildren && isExpanded && (
          <ul className="relative ml-1.5 border-l border-border/60 pl-2 py-0.5 space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      {/* Header & Controls */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5">
          <FolderGit2 className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-xs font-semibold text-foreground">
            Cây lịch sử thực thi · Run #{tree.workflowRunId}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            ({tree.nodes.length} node)
          </span>
        </div>

        {/* Nút thao tác nhanh mở/đóng */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExpandAll}
            className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Mở hết
          </Button>
          <span className="text-muted-foreground/30 text-[10px]">|</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCollapseAll}
            className="h-5 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Thu gọn
          </Button>
        </div>
      </header>

      {/* Cấu trúc cây dạng JSON collapse/expand */}
      <div className="overflow-x-auto py-1">
        {rootNodes.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Chưa có node thực thi nào trong cây.
          </p>
        ) : (
          <ul className="space-y-1">
            {rootNodes.map((root) => renderTreeNode(root, 0))}
          </ul>
        )}
      </div>

      {/* Bản xuất bản */}
      {tree.publications.length > 0 && (
        <section className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3 text-emerald-500" />
            <span>Các bản xuất bản hoàn chỉnh ({tree.publications.length})</span>
          </div>
          <ul className="space-y-1">
            {tree.publications.map((publication) => (
              <li
                key={publication.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs"
              >
                <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-600 dark:text-emerald-300">
                  #{publication.id}
                </Badge>
                <span className="font-mono text-muted-foreground">
                  Gắn với node #{publication.approvedVersionId}
                </span>
                <span className="tabular-nums text-foreground font-medium">
                  {new Intl.NumberFormat("vi-VN").format(publication.totalWords)} từ ·{" "}
                  {Math.max(1, Math.round(publication.estimatedDurationSeconds / 60))} phút
                </span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {formatTime(publication.publishedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
