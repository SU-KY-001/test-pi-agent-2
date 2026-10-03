"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  ListOrdered,
  Loader2,
  MapPin,
  Pencil,
  Sparkles,
} from "lucide-react";
import {
  SOURCE_TIER_LABELS,
  type NarrativeFocusSelection,
  type ResearchConsultation,
  type SourceItem,
} from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ReliabilityBar } from "./source-matrix-card";
import { SourceEditModal } from "./source-edit-modal";

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
  onDirectEdit?: (baseVersion: number, editedOutput: unknown, note?: string) => Promise<void>;
}

export function NarrativeMenuCard({
  consultation,
  activeVersion,
  isSubmitting,
  onApprove,
  onDirectEdit,
}: NarrativeMenuCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedOption =
    consultation.narrativeMenu[selectedIndex] ?? consultation.narrativeMenu[0];
  const [seriesTitle, setSeriesTitle] = useState(selectedOption?.seriesTitle ?? "");
  const [episodeTitles, setEpisodeTitles] = useState<string[]>(
    selectedOption ? [...selectedOption.episodeTitles] : ["", "", ""]
  );
  const [editorialNotes, setEditorialNotes] = useState("");

  // Quản lý modal chỉnh sửa nguồn và trạng thái đóng/mở danh sách nguồn
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [expandedSourceIds, setExpandedSourceIds] = useState<Record<string, boolean>>({});

  const toggleSource = (id: string) => {
    setExpandedSourceIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSaveSources = async (updatedSources: SourceItem[]) => {
    if (!onDirectEdit) return;
    const updatedConsultation: ResearchConsultation = {
      ...consultation,
      sourcesCatalogue: updatedSources,
    };
    await onDirectEdit(
      activeVersion,
      updatedConsultation,
      `Chỉnh sửa danh sách nguồn (${updatedSources.length} nguồn)`
    );
    setIsSourceModalOpen(false);
  };

  useEffect(() => {
    const option =
      consultation.narrativeMenu[selectedIndex] ?? consultation.narrativeMenu[0];
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
    seriesTitle.trim().length > 0 &&
    episodeTitles.every((title) => title.trim().length > 0) &&
    !isSubmitting;

  const handleApprove = () => {
    if (!canApprove) return;
    const trimmedTitles = episodeTitles.map((title) => title.trim());
    void onApprove({
      selectedFocusType: selectedOption.focusType,
      seriesTitle: seriesTitle.trim(),
      episodeTitles: [
        trimmedTitles[0] ?? "",
        trimmedTitles[1] ?? "",
        trimmedTitles[2] ?? "",
      ],
      editorialNotes:
        editorialNotes.trim().length > 0 ? editorialNotes.trim() : undefined,
    });
  };

  const sources = consultation.sourcesCatalogue ?? [];

  return (
    <section className="space-y-4 rounded-xl border border-amber-400/40 bg-amber-500/5 p-4">
      {/* 1. Tiêu đề Gate 0 & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
          <Sparkles className="size-4" aria-hidden />
          Gate 0 · Chọn trọng tâm kể &amp; duyệt nguồn
        </h3>
        <Badge variant="outline" className="border-amber-400/40 text-[10px] text-amber-200">
          Đang chờ duyệt v{activeVersion}
        </Badge>
      </div>

      {/* 2. Thống kê bối cảnh */}
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
            {sources.length} nguồn · {consultation.narrativeMenu.length} trọng tâm
          </span>
        </div>
      </div>

      {/* 3. Khối Nguồn ứng viên: Accordion thu gọn tổng thể + Card thu gọn từng nguồn */}
      <div className="rounded-lg border border-border/60 bg-background/50 p-3 shadow-xs">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsSourcesOpen(!isSourcesOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsSourcesOpen(!isSourcesOpen);
            }
          }}
          className="flex cursor-pointer items-center justify-between gap-2 select-none"
        >
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Danh mục nguồn ứng viên ({sources.length} nguồn)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onDirectEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSourceModalOpen(true);
                }}
                className="h-6 gap-1 px-2 text-[11px] font-medium"
              >
                <Pencil className="size-3" />
                <span>Chỉnh sửa nguồn</span>
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground">
              {isSourcesOpen ? "Thu gọn" : "Xem toàn bộ"}
            </span>
            <Button variant="ghost" size="icon" className="size-5 p-0">
              {isSourcesOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </Button>
          </div>
        </div>

        {/* Nội dung danh sách nguồn mở rộng */}
        {isSourcesOpen && (
          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5 max-h-[380px] overflow-y-auto pr-1">
            {sources.map((source: SourceItem) => {
              const isExpanded = expandedSourceIds[source.id] ?? false;
              return (
                <div
                  key={source.id}
                  className={cn(
                    "rounded-md border border-border/50 bg-background/60 transition-all",
                    isExpanded ? "border-amber-400/40 bg-accent/15" : "hover:border-border"
                  )}
                >
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
                    className="flex cursor-pointer items-center justify-between gap-2 p-2 select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Button variant="ghost" size="icon" className="size-4 shrink-0 p-0 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      </Button>
                      <Badge variant="outline" className={cn("text-[9px] font-normal shrink-0", TIER_CLASS[source.tier])}>
                        {SOURCE_TIER_LABELS[source.tier]}
                      </Badge>
                      <span className="truncate text-xs font-medium text-foreground">{source.name}</span>
                      {source.isPrimaryAssertionSource && (
                        <Badge variant="outline" className="border-emerald-500/40 text-[9px] text-emerald-300 shrink-0">
                          Nguồn khẳng định
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
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-1.5 border-t border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
                        <div>
                          <span className="text-foreground/70 font-medium">Tác giả / Xuất xứ:</span>{" "}
                          <span className="text-foreground">{source.authorOrOrigin}</span>
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

                      {source.crossVerificationNotes && (
                        <p className="text-[11px] leading-relaxed text-muted-foreground pt-1 border-t border-border/20">
                          <span className="font-semibold text-foreground">Đối chiếu chéo: </span>
                          {source.crossVerificationNotes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Menu trọng tâm kể */}
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

      {/* 5. Vùng biểu mẫu tinh chỉnh biên tập trước khi phê duyệt */}
      <div className="space-y-3 rounded-lg border border-border/60 bg-background/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-xs font-semibold text-foreground">
            Biên tập trước khi duyệt · trọng tâm: {selectedOption.focusLabel}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Điền nhanh:</span>
            <button
              type="button"
              onClick={() => {
                setSeriesTitle(selectedOption.seriesTitle);
                setEpisodeTitles([...selectedOption.episodeTitles]);
                setEditorialNotes("Ưu tiên tư liệu chính sử, giữ giọng điệu trung tính hào hùng.");
              }}
              className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80 transition-colors"
              title="Điền dữ liệu mẫu đề xuất"
            >
              Mẫu chuẩn
            </button>
            <button
              type="button"
              onClick={() => {
                setSeriesTitle(`[Podcast] ${selectedOption.seriesTitle} (Bản Phát Thanh)`);
                setEpisodeTitles([
                  `Tập 1: Tiền sự kiện & Khúc dạo đầu`,
                  `Tập 2: Đỉnh điểm chiến trường & Cơ chế then chốt`,
                  `Tập 3: Kết cục & Bài học nghìn năm`,
                ]);
                setEditorialNotes("Nhịp điệu dồn dập, gọt câu ngắn cho phát thanh viên.");
              }}
              className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-muted/80 transition-colors"
              title="Điền kịch tính cho phát thanh"
            >
              Bản phát thanh
            </button>
          </div>
        </div>

        {/* Tên Series */}
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">Tên series podcast</span>
          <input
            value={seriesTitle}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSeriesTitle(event.target.value)}
            className={TITLE_INPUT_CLASS}
            aria-label="Tên series podcast"
          />
        </label>

        {/* 3 Input tên 3 tập: Xếp DỌC thay vì ngang để có đủ không gian cho tên dài */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <ListOrdered className="size-3 text-primary" />
            <span>Tên 3 tập thành phần (Xếp theo thứ tự phát sóng):</span>
          </label>
          <div className="space-y-2">
            {episodeTitles.map((title, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-2 py-1"
              >
                <span className="shrink-0 flex items-center justify-center size-5 rounded-full bg-muted font-mono text-[10px] font-semibold text-foreground">
                  {index + 1}
                </span>
                <input
                  value={title}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setEpisodeTitles((prev) =>
                      prev.map((item, position) => (position === index ? event.target.value : item))
                    )
                  }
                  className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  aria-label={`Tên tập ${index + 1}`}
                  placeholder={`Tập ${index + 1}: Nhập tên tập…`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Ghi chú biên tập */}
        <label className="block space-y-1 pt-1">
          <span className="text-[11px] font-medium text-muted-foreground">Ghi chú biên tập (không bắt buộc)</span>
          <Textarea
            rows={2}
            value={editorialNotes}
            onChange={(event) => setEditorialNotes(event.target.value)}
            placeholder="Ví dụ: ưu tiên phân tích cơ chế bãi cọc, hạn chế truyền thuyết dân gian…"
            className="resize-y text-xs"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {!canApprove && (
            <span className="text-[11px] text-muted-foreground">
              Điền đủ tên series và 3 tên tập để duyệt.
            </span>
          )}
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

      {/* Modal chỉnh sửa danh sách nguồn */}
      {onDirectEdit && (
        <SourceEditModal
          isOpen={isSourceModalOpen}
          onClose={() => setIsSourceModalOpen(false)}
          initialSources={sources}
          onSave={handleSaveSources}
          isSubmitting={isSubmitting}
        />
      )}
    </section>
  );
}
