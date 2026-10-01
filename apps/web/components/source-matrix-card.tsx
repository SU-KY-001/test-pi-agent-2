"use client";

import { AlertTriangle, Link2, ShieldCheck } from "lucide-react";
import { SOURCE_TIER_LABELS, type EvaluatedCorpus } from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-foreground">Ma trận nguồn đã thẩm định</span>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {corpus.evaluatedSources.length} nguồn
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          Trọng tâm: {corpus.selectedFocusType}
        </Badge>
      </div>

      <ul className="space-y-1.5">
        {corpus.evaluatedSources.map((source) => (
          <li key={source.id} className="space-y-1 rounded-md border border-border/50 bg-background/40 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground">{source.name}</span>
              <Badge variant="outline" className={cn("text-[10px] font-normal", TIER_CLASS[source.tier])}>
                {SOURCE_TIER_LABELS[source.tier]}
              </Badge>
              <ReliabilityBar score={source.reliabilityScore} />
              <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
                {source.crossVerificationRole === "CLAIM_SUPPORT" ? (
                  <ShieldCheck className="size-3" aria-hidden />
                ) : (
                  <Link2 className="size-3" aria-hidden />
                )}
                {source.crossVerificationRole === "CLAIM_SUPPORT" ? "Nguồn khẳng định" : "Nguồn khám phá"}
              </Badge>
              {source.echoChamberFlag && (
                <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-300">
                  <AlertTriangle className="size-3" aria-hidden />
                  Echo chamber
                </Badge>
              )}
              {source.crossVerificationRole === "CLAIM_SUPPORT" && (
                <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-300">
                  Nguồn khẳng định
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{source.notes}</p>
            {source.debatedDetails.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] italic text-muted-foreground">
                {source.debatedDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {corpus.crossVerificationSummary && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Kiểm chứng chéo: </span>
          {corpus.crossVerificationSummary}
        </div>
      )}

      {corpus.singleSidedSourceWarnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-amber-300">Cảnh báo nguồn một chiều</span>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {corpus.singleSidedSourceWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {corpus.flaggedInsufficientSources.length > 0 && (
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
