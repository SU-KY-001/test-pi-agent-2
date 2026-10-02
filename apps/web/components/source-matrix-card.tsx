"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Filter, Layers, MapPin } from "lucide-react";
import { SOURCE_TIER_LABELS, type EvaluatedCorpus, type EvaluatedSource } from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const TIER_CLASS: Record<string, string> = {
  TIER_1_CHINH_SU: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  TIER_2_KHAO_CO: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  TIER_3_KHOA_HOC: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  TIER_4_DA_SU: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function ReliabilityBar({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn(
            "block h-full rounded-full",
            score >= 8 ? "bg-emerald-500" : score >= 5 ? "bg-sky-500" : "bg-amber-500"
          )}
          style={{ width: `${Math.min(100, score * 10)}%` }}
        />
      </span>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{score}/10</span>
    </span>
  );
}

export function SourceMatrixCard({ corpus }: { corpus: EvaluatedCorpus }) {
  const sources = corpus.evaluatedSources ?? [];
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [expandedSourceIds, setExpandedSourceIds] = useState<Record<string, boolean>>({});

  const toggleSource = (id: string) => {
    setExpandedSourceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredSources = sources.filter((s) => {
    if (selectedTier === "ALL") return true;
    return s.tier === selectedTier;
  });

  return (
    <div className="space-y-3">
      {/* 1. Accordion tổng thể cho ma trận nguồn */}
      <div className="rounded-lg border border-border/70 bg-card p-3 shadow-xs">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsSectionOpen(!isSectionOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsSectionOpen(!isSectionOpen);
            }
          }}
          className="flex cursor-pointer items-center justify-between gap-2 select-none"
        >
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Ma trận nguồn đã thẩm định
            </h3>
            <Badge variant="outline" className="text-[10px] font-normal">
              {sources.length} nguồn
            </Badge>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              Trọng tâm: {corpus.selectedFocusType}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {isSectionOpen ? "Thu gọn danh sách" : "Xem chi tiết nguồn"}
            </span>
            <Button variant="ghost" size="icon" className="size-6 p-0">
              {isSectionOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Nội dung danh sách nguồn khi mở rộng */}
        {isSectionOpen && (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
            {/* Bộ lọc theo Tier */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2 rounded-md">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="size-3.5" />
                <span>Lọc theo cấp độ:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant={selectedTier === "ALL" ? "default" : "outline"}
                  className="h-6 px-2 text-[10px] rounded-full"
                  onClick={() => setSelectedTier("ALL")}
                >
                  Tất cả ({sources.length})
                </Button>
                {Object.keys(SOURCE_TIER_LABELS).map((tierKey) => {
                  const count = sources.filter((s) => s.tier === tierKey).length;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={tierKey}
                      size="sm"
                      variant={selectedTier === tierKey ? "default" : "outline"}
                      className={cn("h-6 px-2 text-[10px] rounded-full", TIER_CLASS[tierKey])}
                      onClick={() => setSelectedTier(tierKey)}
                    >
                      {SOURCE_TIER_LABELS[tierKey as keyof typeof SOURCE_TIER_LABELS].split("·")[0]} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Danh sách thẻ nguồn dạng accordion từng thẻ */}
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
              {filteredSources.map((source: EvaluatedSource) => {
                const isExpanded = expandedSourceIds[source.id] ?? false;
                return (
                  <div
                    key={source.id}
                    className={cn(
                      "rounded-md border border-border/60 bg-background/60 transition-all",
                      isExpanded ? "border-primary/40 bg-accent/15 shadow-xs" : "hover:border-border"
                    )}
                  >
                    {/* Header tóm tắt của Card nguồn */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSource(source.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSource(source.id);
                        }
                      }}
                      className="flex cursor-pointer items-center justify-between gap-2 p-2.5 select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0 p-0 text-muted-foreground"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </Button>
                        <Badge variant="outline" className={cn("text-[10px] font-normal shrink-0", TIER_CLASS[source.tier])}>
                          {SOURCE_TIER_LABELS[source.tier]}
                        </Badge>
                        <span className="truncate text-xs font-medium text-foreground">
                          {source.name}
                        </span>
                        {source.echoChamberFlag && (
                          <Badge variant="outline" className="gap-0.5 border-amber-500/40 bg-amber-500/10 text-[9px] text-amber-300 shrink-0">
                            <AlertTriangle className="size-2.5" aria-hidden /> Echo
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <ReliabilityBar score={source.reliabilityScore} />
                        {source.url && (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary hover:underline p-0.5"
                            title="Mở liên kết nguồn"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Vùng chi tiết chỉ hiện khi click mở rộng */}
                    {isExpanded && (
                      <div className="space-y-2 border-t border-border/40 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground/70 font-medium">Vai trò:</span>
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {source.crossVerificationRole === "CLAIM_SUPPORT" ? "Nguồn khẳng định" : "Nguồn khám phá"}
                            </Badge>
                          </div>
                          {source.locationInSource && (
                            <div className="flex items-center gap-1 text-primary font-medium">
                              <MapPin className="size-3 shrink-0" />
                              <span>Vị trí trong nguồn: {source.locationInSource}</span>
                            </div>
                          )}
                          {source.url && (
                            <div className="flex items-center gap-1 md:col-span-2">
                              <ExternalLink className="size-3 shrink-0" />
                              <span className="text-foreground/70 font-medium">URL:</span>
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate max-w-[360px]"
                              >
                                {source.url}
                              </a>
                            </div>
                          )}
                        </div>

                        {source.notes && (
                          <p className="text-[11px] leading-relaxed text-muted-foreground pt-1 border-t border-border/20">
                            {source.notes}
                          </p>
                        )}

                        {source.debatedDetails && source.debatedDetails.length > 0 && (
                          <div className="rounded bg-background/80 p-2 text-[11px] border border-border/30">
                            <span className="font-semibold text-foreground">Chi tiết tranh biện: </span>
                            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground mt-1">
                              {source.debatedDetails.map((detail, index) => (
                                <li key={index}>{detail}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {corpus.crossVerificationSummary && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Kiểm chứng chéo: </span>
          {corpus.crossVerificationSummary}
        </div>
      )}

      {corpus.singleSidedSourceWarnings && corpus.singleSidedSourceWarnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-amber-300">Cảnh báo nguồn một chiều</span>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {corpus.singleSidedSourceWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {corpus.flaggedInsufficientSources && corpus.flaggedInsufficientSources.length > 0 && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-red-300">Nguồn bị đánh dấu thiếu căn cứ</span>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {corpus.flaggedInsufficientSources.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
