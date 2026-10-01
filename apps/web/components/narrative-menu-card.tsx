"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import {
  SOURCE_TIER_LABELS,
  type NarrativeFocusSelection,
  type ResearchConsultation,
} from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ReliabilityBar } from "./source-matrix-card";

const TITLE_INPUT_CLASS =
  "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-md border bg-transparent px-2.5 text-xs shadow-xs outline-none focus-visible:ring-[3px]";

const TIER_CLASS: Record<string, string> = {
  TIER_1_CHINH_SU: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  TIER_2_KHAO_CO: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  TIER_3_KHOA_HOC: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  TIER_4_DA_SU: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export interface NarrativeMenuCardProps {
  consultation: ResearchConsultation;
  activeVersion: number;
  isSubmitting: boolean;
  onApprove: (selection: NarrativeFocusSelection) => void | Promise<void>;
}

export function NarrativeMenuCard({ consultation, activeVersion, isSubmitting, onApprove }: NarrativeMenuCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedOption = consultation.narrativeMenu[selectedIndex] ?? consultation.narrativeMenu[0];
  const [seriesTitle, setSeriesTitle] = useState(selectedOption?.seriesTitle ?? "");
  const [episodeTitles, setEpisodeTitles] = useState<string[]>(
    selectedOption ? [...selectedOption.episodeTitles] : ["", "", ""]
  );
  const [editorialNotes, setEditorialNotes] = useState("");

  useEffect(() => {
    const option = consultation.narrativeMenu[selectedIndex] ?? consultation.narrativeMenu[0];
    if (!option) return;
    setSeriesTitle(option.seriesTitle);
    setEpisodeTitles([...option.episodeTitles]);
    setEditorialNotes("");
  }, [selectedIndex, activeVersion, consultation]);

  if (!selectedOption) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
        Bước Tư vấn biên tập không trả về menu trọng tâm kể nào. Hãy chạy lại nhánh mới với phản hồi cụ thể.
      </p>
    );
  }

  const canApprove =
    seriesTitle.trim().length > 0 && episodeTitles.every((title) => title.trim().length > 0) && !isSubmitting;

  const handleApprove = () => {
    if (!canApprove) return;
    const trimmedTitles = episodeTitles.map((title) => title.trim());
    void onApprove({
      selectedFocusType: selectedOption.focusType,
      seriesTitle: seriesTitle.trim(),
      episodeTitles: [trimmedTitles[0] ?? "", trimmedTitles[1] ?? "", trimmedTitles[2] ?? ""],
      editorialNotes: editorialNotes.trim().length > 0 ? editorialNotes.trim() : undefined,
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-amber-400/40 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
          <Sparkles className="size-4" aria-hidden />
          Gate 0 · Chọn trọng tâm kể &amp; duyệt nguồn
        </h3>
        <Badge variant="outline" className="border-amber-400/40 text-[10px] text-amber-200">
          Đang chờ duyệt v{activeVersion}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-[11px] sm:grid-cols-4">
        <div>
          <span className="block text-muted-foreground">Chủ đề</span>
          <span className="font-medium text-foreground">{consultation.topic}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">Thời gian</span>
          <span className="font-medium text-foreground">{consultation.historicalTimeframe}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">Không gian</span>
          <span className="font-medium text-foreground">{consultation.geographicScope}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">Nguồn đề xuất</span>
          <span className="font-medium tabular-nums text-foreground">
            {consultation.sourcesCatalogue.length} nguồn · {consultation.narrativeMenu.length} trọng tâm
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground">Nguồn ứng viên</span>
        <ul className="space-y-1">
          {consultation.sourcesCatalogue.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5"
            >
              <span className="text-[11px] font-medium text-foreground">{source.name}</span>
              <Badge variant="outline" className={cn("text-[10px] font-normal", TIER_CLASS[source.tier])}>
                {SOURCE_TIER_LABELS[source.tier]}
              </Badge>
              <ReliabilityBar score={source.reliabilityScore} />
              {source.isPrimaryAssertionSource && (
                <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-300">
                  Nguồn khẳng định
                </Badge>
              )}
              <span className="w-full text-[11px] text-muted-foreground">
                {source.authorOrOrigin} · {source.crossVerificationNotes}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-foreground">Menu 5 trọng tâm kể</legend>
        <div className="space-y-2">
          {consultation.narrativeMenu.map((option, index) => {
            const checked = index === selectedIndex;
            return (
              <label
                key={option.focusType + index}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  checked
                    ? "border-amber-400/60 bg-amber-500/10"
                    : "border-border/60 bg-background/40 hover:border-amber-400/30"
                )}
              >
                <input
                  type="radio"
                  name="narrative-focus"
                  value={option.focusType}
                  checked={checked}
                  onChange={() => setSelectedIndex(index)}
                  className="mt-1 size-4 shrink-0 accent-amber-500"
                />
                <span className="flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{option.focusLabel}</span>
                    <Badge variant="outline" className="font-mono text-[10px] font-normal text-muted-foreground">
                      {option.focusType}
                    </Badge>
                  </span>
                  <span className="block text-[11px] text-muted-foreground">{option.angleDescription}</span>
                  <span className="block text-[11px] italic text-muted-foreground">
                    Vì sao đề xuất: {option.recommendedBecause}
                  </span>
                  <span className="block text-[11px] text-foreground/80">
                    Series: {option.seriesTitle} · Tập: {option.episodeTitles.join(" / ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
        <span className="text-xs font-semibold text-foreground">
          Biên tập trước khi duyệt · trọng tâm đã chọn: {selectedOption.focusLabel}
        </span>
        <label className="block space-y-1">
          <span className="text-[11px] text-muted-foreground">Tên series</span>
          <input
            value={seriesTitle}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSeriesTitle(event.target.value)}
            className={TITLE_INPUT_CLASS}
            aria-label="Tên series podcast"
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {episodeTitles.map((title, index) => (
            <label key={index} className="block space-y-1">
              <span className="text-[11px] text-muted-foreground">Tên tập {index + 1}</span>
              <input
                value={title}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setEpisodeTitles((prev) => prev.map((item, position) => (position === index ? event.target.value : item)))
                }
                className={TITLE_INPUT_CLASS}
                aria-label={`Tên tập ${index + 1}`}
              />
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-[11px] text-muted-foreground">Ghi chú biên tập (không bắt buộc)</span>
          <Textarea
            rows={2}
            value={editorialNotes}
            onChange={(event) => setEditorialNotes(event.target.value)}
            placeholder="Ví dụ: ưu tiên phân tích cơ chế bãi cọc, hạn chế truyền thuyết dân gian…"
            className="resize-y text-xs"
          />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!canApprove && <span className="text-[11px] text-muted-foreground">Điền đủ tên series và 3 tên tập để duyệt.</span>}
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={!canApprove}
            className="gap-1.5 bg-amber-500 text-xs font-semibold text-amber-950 hover:bg-amber-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Đang duyệt…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" aria-hidden /> Duyệt &amp; chạy tiếp
              </>
            )}
          </Button>
        </div>
      </div>

      {consultation.initialResearchQuestions.length > 0 && (
        <details className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
            Câu hỏi nghiên cứu ban đầu ({consultation.initialResearchQuestions.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {consultation.initialResearchQuestions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
