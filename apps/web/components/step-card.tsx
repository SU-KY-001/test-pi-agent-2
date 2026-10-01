"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Code2,
  Compass,
  FileSearch,
  FileText,
  Loader2,
  PenLine,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  EvaluatedCorpusSchema,
  OralizedScriptSchema,
  PodcastScriptDraftSchema,
  ResearchConsultationSchema,
  ResearchPackSchema,
  ReviewReportSchema,
  StoryOutlineSchema,
  type StepStatus,
  type StepType,
  type StepVersion,
} from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { statusBadgeClass, statusLabel } from "@/lib/step-status";
import { ActionDeck } from "./action-deck";
import { SourceMatrixCard } from "./source-matrix-card";
import { LivePodcastPreview, formatDuration, formatWordCount } from "./live-podcast-preview";

export interface StepCardProps {
  type: StepType;
  label: string;
  description: string;
  status: StepStatus;
  currentVersion: number | null;
  approvedVersion: number | null;
  reviewer: string;
  activeVersion: number | null;
  incomingGuidance?: string | null;
  errorMessage?: string | null;
  versions: StepVersion[];
  isSubmitting?: boolean;
  onSelectVersion?: (version: number) => void;
  onRerun: (feedback: string) => Promise<void>;
  onContinue?: (version: number, guidance?: string) => Promise<void>;
  onDirectEdit?: (baseVersion: number, editedOutput: unknown, note?: string) => Promise<void>;
  continueLabel?: string;
  /** Card nghiệp vụ riêng của từng Gate (Gate 0/1/2), do page dựng. */
  gateContent?: React.ReactNode;
}

const STEP_ICONS: Record<StepType, typeof FileSearch> = {
  RESEARCHER: Compass,
  SOURCE_EVALUATOR: FileSearch,
  FACT_EXTRACTOR: FileText,
  STORY_PLANNER: Sparkles,
  SCRIPT_WRITER: PenLine,
  ORALIZER: Activity,
  FACT_CHECKER: ShieldCheck,
};

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

const CONFIDENCE_CLASS: Record<string, string> = {
  CONFIRMED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  DEBATED: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  INSUFFICIENT: "border-red-500/40 bg-red-500/10 text-red-300",
};

function EmptyOutput() {
  return <p className="text-[11px] italic text-muted-foreground">Node này chưa có dữ liệu đầu ra.</p>;
}

function ResearchConsultationView({ output }: { output: unknown }) {
  const parsed = ResearchConsultationSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  const data = parsed.data;
  return (
    <dl className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <dt className="text-muted-foreground">Chủ đề</dt>
        <dd className="font-medium text-foreground">{data.topic}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Khoảng thời gian</dt>
        <dd className="font-medium text-foreground">{data.historicalTimeframe}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Phạm vi địa lý</dt>
        <dd className="font-medium text-foreground">{data.geographicScope}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Nguồn ứng viên</dt>
        <dd className="font-medium tabular-nums text-foreground">{data.sourcesCatalogue.length}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Trọng tâm kể đề xuất</dt>
        <dd className="font-medium tabular-nums text-foreground">{data.narrativeMenu.length}</dd>
      </div>
      <p className="col-span-2 text-[11px] italic text-muted-foreground">
        Chi tiết ma trận nguồn &amp; menu trọng tâm nằm ở card Gate 0 khi bước này chờ duyệt.
      </p>
    </dl>
  );
}

function FactExtractorView({ output }: { output: unknown }) {
  const parsed = ResearchPackSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  const pack = parsed.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-foreground">
          {pack.factCards.length} fact card · {pack.keyEntities.length} nhân vật · {pack.identifiedResearchGaps.length} khoảng trống
        </span>
        <span className="text-[11px] text-muted-foreground">Trọng tâm: {pack.selectedNarrativeFocus}</span>
      </div>
      <ul className="space-y-1.5">
        {pack.factCards.slice(0, 12).map((card) => (
          <li key={card.id} className="space-y-1 rounded-md border border-border/50 bg-background/40 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">{card.id}</span>
              <Badge variant="outline" className={cn("text-[10px] font-normal", CONFIDENCE_CLASS[card.confidence])}>
                {card.confidence}
              </Badge>
              {card.timePoint && <span className="text-[10px] text-muted-foreground">{card.timePoint}</span>}
            </div>
            <p className="text-[11px] font-medium text-foreground">{card.claim}</p>
            <p className="text-[11px] italic text-muted-foreground">
              {card.sourceReference} — “{card.citationSnippet}”
            </p>
          </li>
        ))}
      </ul>
      {pack.factCards.length > 12 && (
        <p className="text-[11px] text-muted-foreground">… còn {pack.factCards.length - 12} fact card khác trong JSON.</p>
      )}
      {pack.chronologicalTimeline.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Dòng thời gian</span>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {pack.chronologicalTimeline.map((entry, index) => (
              <li key={index}>
                <span className="font-medium text-foreground">{entry.time}</span> · {entry.event} ({entry.factCardId})
              </li>
            ))}
          </ul>
        </div>
      )}
      {pack.identifiedResearchGaps.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-amber-300">Khoảng trống sử liệu</span>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {pack.identifiedResearchGaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StoryPlannerView({ output }: { output: unknown }) {
  const parsed = StoryOutlineSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  const outline = parsed.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-foreground">{outline.seriesTitle}</span>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {outline.narrativeFocus}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          3 tập (SPDC)
        </Badge>
      </div>
      {outline.episodes.map((episode) => (
        <article key={episode.episodeNumber} className="space-y-1.5 rounded-md border border-border/50 bg-background/40 p-2.5">
          <h4 className="text-xs font-bold text-foreground">
            Tập {episode.episodeNumber} · {episode.episodeTitle}
          </h4>
          <p className="text-[11px] italic text-muted-foreground">Câu hỏi trung tâm: {episode.centralQuestion}</p>
          <dl className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Situation</dt>
              <dd className="text-foreground/90">{episode.spdcCycle.situation}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Problem</dt>
              <dd className="text-foreground/90">{episode.spdcCycle.problem}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Decision</dt>
              <dd className="text-foreground/90">{episode.spdcCycle.decision}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Consequence</dt>
              <dd className="text-foreground/90">{episode.spdcCycle.consequence}</dd>
            </div>
          </dl>
          {episode.narrativeBeats.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Nhịp kể: {episode.narrativeBeats.join(" → ")}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Hook kết tập: <span className="text-foreground/90">{episode.hookEnd}</span>
          </p>
        </article>
      ))}
    </div>
  );
}

function ScriptWriterView({ output }: { output: unknown }) {
  const parsed = PodcastScriptDraftSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  const draft = parsed.data;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="text-xs font-semibold text-foreground">{draft.seriesTitle}</span>
        <span className="tabular-nums">Tổng: {formatWordCount(draft.totalWordCount)}</span>
      </div>
      {draft.episodes.map((episode) => (
        <details key={episode.episodeNumber} className="rounded-md border border-border/50 bg-background/40 p-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-foreground">
            Tập {episode.episodeNumber} · {episode.episodeTitle}{" "}
            <span className="font-mono font-normal text-muted-foreground">
              ({formatWordCount(episode.wordCount)} · {formatDuration(episode.estimatedDurationSeconds)})
            </span>
          </summary>
          <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
            {episode.narration}
          </p>
        </details>
      ))}
    </div>
  );
}

function OralizerView({ output }: { output: unknown }) {
  const parsed = OralizedScriptSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  return <LivePodcastPreview script={parsed.data} />;
}

function FactCheckerView({ output }: { output: unknown }) {
  const parsed = ReviewReportSchema.safeParse(output);
  if (!parsed.success) return <EmptyOutput />;
  const report = parsed.data;
  const lint = report.oralLinter;
  const lintClean =
    !lint.hasForbiddenHyphens && !lint.hasForbiddenColons && !lint.hasForbiddenParentheses && !lint.hasFragmentedSentences;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {report.passed ? (
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-[11px] text-emerald-300">
            ✓ ĐẠT kiểm định
          </Badge>
        ) : (
          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-[11px] text-red-300">
            ✗ CHƯA ĐẠT
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Điểm tổng: <span className="font-mono font-semibold text-foreground">{report.overallScore}/100</span>
        </span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-normal",
            lintClean ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"
          )}
        >
          {lintClean ? "Text-for-Ear hợp lệ" : "Còn lỗi văn nói"}
        </Badge>
      </div>

      {report.moderatorSummaryFeedback && (
        <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
          {report.moderatorSummaryFeedback}
        </p>
      )}

      {report.claimVerification.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Đối chiếu claim với fact card ({report.claimVerification.length})
          </span>
          <ul className="space-y-1">
            {report.claimVerification.map((claim, index) => (
              <li key={index} className="space-y-0.5 rounded-md border border-border/50 bg-background/40 p-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-normal",
                      claim.status === "VERIFIED" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
                      claim.status === "UNSUPPORTED_SPECULATION" && "border-amber-500/40 bg-amber-500/10 text-amber-300",
                      claim.status === "CONTRADICTION" && "border-red-500/40 bg-red-500/10 text-red-300"
                    )}
                  >
                    {claim.status}
                  </Badge>
                  {claim.matchedFactCardId && (
                    <span className="font-mono text-[10px] text-muted-foreground">{claim.matchedFactCardId}</span>
                  )}
                </div>
                <p className="text-foreground/90">“{claim.scriptSentence}”</p>
                <p className="text-muted-foreground">{claim.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lint.errorDetails.length > 0 && (
        <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-amber-300">Lỗi linter văn nói</span>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
            {lint.errorDetails.map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StepOutputView({ type, output }: { type: StepType; output: unknown }) {
  switch (type) {
    case "RESEARCHER":
      return <ResearchConsultationView output={output} />;
    case "SOURCE_EVALUATOR": {
      const parsed = EvaluatedCorpusSchema.safeParse(output);
      return parsed.success ? <SourceMatrixCard corpus={parsed.data} /> : <EmptyOutput />;
    }
    case "FACT_EXTRACTOR":
      return <FactExtractorView output={output} />;
    case "STORY_PLANNER":
      return <StoryPlannerView output={output} />;
    case "SCRIPT_WRITER":
      return <ScriptWriterView output={output} />;
    case "ORALIZER":
      return <OralizerView output={output} />;
    case "FACT_CHECKER":
      return <FactCheckerView output={output} />;
  }
}

export function StepCard({
  type,
  label,
  description,
  status,
  currentVersion,
  approvedVersion,
  reviewer,
  activeVersion,
  incomingGuidance,
  errorMessage,
  versions,
  isSubmitting = false,
  onSelectVersion,
  onRerun,
  onContinue,
  onDirectEdit,
  continueLabel,
  gateContent,
}: StepCardProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  const Icon = STEP_ICONS[type];
  const activeVersionData = versions.find((version) => version.version === activeVersion);
  const output = activeVersionData?.outputJson ?? null;
  const hasOutput = output != null;
  const canRerun = currentVersion != null && (status === "COMPLETED" || status === "STALE" || status === "WAITING_FOR_HUMAN");

  return (
    <Card
      className={cn(
        "border transition-all duration-200",
        status === "RUNNING" && "border-sky-300 shadow-xs dark:border-sky-800",
        status === "WAITING_FOR_HUMAN" && "border-amber-400 shadow-md ring-1 ring-amber-400/30 dark:border-amber-700",
        status === "STALE" && "border-dashed bg-muted/20 opacity-80"
      )}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span
              className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", statusBadgeClass(status))}
            >
              <StepStatusIcon status={status} Icon={Icon} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold tracking-tight">{label}</CardTitle>
                <Badge variant="outline" className={cn("text-[11px] font-normal", statusBadgeClass(status))}>
                  {statusLabel(status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Người ký duyệt: <span className="text-foreground/80">{reviewer}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {currentVersion != null && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">v{currentVersion}</span>
            )}
            {approvedVersion != null && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Đã duyệt v{approvedVersion}
              </span>
            )}
          </div>
        </div>

        {incomingGuidance && (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            <span className="text-sm" aria-hidden>
              💡
            </span>
            <div>
              <span className="font-semibold">Lời dặn từ bước trước: </span>
              <span className="italic">{incomingGuidance}</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-2.5 rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            ⚠️ {errorMessage}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {versions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
            <span className="text-[11px] font-medium text-muted-foreground">Phiên bản:</span>
            {versions.map((version) => {
              const forked = version.parentVersionId != null;
              return (
                <Button
                  key={version.id}
                  size="sm"
                  variant={version.version === activeVersion ? "default" : "outline"}
                  onClick={() => onSelectVersion?.(version.version)}
                  aria-pressed={version.version === activeVersion}
                  title={
                    forked
                      ? `Nhánh v${version.version} — fork từ node ${version.parentVersionId}`
                      : `Node gốc v${version.version}`
                  }
                  className="h-6 px-2 font-mono text-xs"
                >
                  v{version.version}
                  {forked && <span className="text-[9px] opacity-70">↳</span>}
                </Button>
              );
            })}
            {activeVersionData?.humanFeedback && (
              <span className="text-[11px] italic text-muted-foreground">
                Phản hồi đã dùng: {activeVersionData.humanFeedback}
              </span>
            )}
          </div>
        )}

        {hasOutput && (
          <div className="space-y-1 rounded-lg border border-border/70 bg-card/60 p-3 text-xs">
            <StepOutputView type={type} output={output} />
          </div>
        )}

        {gateContent}

        {status === "WAITING_FOR_HUMAN" && activeVersion != null && (
          <ActionDeck
            stepType={type}
            currentVersion={activeVersion}
            currentOutputJson={output}
            onRerun={onRerun}
            onContinue={onContinue}
            onDirectEdit={onDirectEdit}
            isSubmitting={isSubmitting}
            continueLabel={continueLabel}
          />
        )}

        {status === "COMPLETED" && onContinue == null && canRerun && activeVersion != null && (
          <ActionDeck
            stepType={type}
            currentVersion={activeVersion}
            currentOutputJson={output}
            onRerun={onRerun}
            isSubmitting={isSubmitting}
          />
        )}

        {hasOutput && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              aria-expanded={showRawJson}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {showRawJson ? <ChevronUp className="size-3" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />}
              <Code2 className="size-3" aria-hidden />
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
