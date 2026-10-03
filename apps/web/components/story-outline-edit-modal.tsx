"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  type StoryEpisodeOutline,
  type StoryOutline,
} from "@repo/contracts";
import { Button } from "./ui/button";

interface StoryOutlineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOutline: StoryOutline;
  onSave: (updatedOutline: StoryOutline) => Promise<void>;
  isSubmitting: boolean;
}

export function StoryOutlineEditModal({
  isOpen,
  onClose,
  initialOutline,
  onSave,
  isSubmitting,
}: StoryOutlineEditModalProps) {
  const [seriesTitle, setSeriesTitle] = useState("");
  const [episodes, setEpisodes] = useState<
    [StoryEpisodeOutline, StoryEpisodeOutline, StoryEpisodeOutline] | null
  >(null);
  const [activeEpIndex, setActiveEpIndex] = useState<0 | 1 | 2>(0);
  const [isSpdcOpen, setIsSpdcOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const cloned = structuredClone(initialOutline);
        setSeriesTitle(cloned.seriesTitle);
        setEpisodes(cloned.episodes);
      } catch {
        setSeriesTitle(initialOutline.seriesTitle);
        setEpisodes([
          { ...initialOutline.episodes[0] },
          { ...initialOutline.episodes[1] },
          { ...initialOutline.episodes[2] },
        ]);
      }
      setActiveEpIndex(0);
      setIsSpdcOpen(false);
      setErrorMsg(null);
    }
  }, [isOpen, initialOutline]);

  // Đóng modal bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !episodes) return null;

  const currentEp = episodes[activeEpIndex];

  const updateCurrentEpisode = (patch: Partial<StoryEpisodeOutline>) => {
    setEpisodes((prev) => {
      if (!prev) return prev;
      const nextEpisodes: [StoryEpisodeOutline, StoryEpisodeOutline, StoryEpisodeOutline] = [
        activeEpIndex === 0 ? { ...prev[0], ...patch } : prev[0],
        activeEpIndex === 1 ? { ...prev[1], ...patch } : prev[1],
        activeEpIndex === 2 ? { ...prev[2], ...patch } : prev[2],
      ];
      return nextEpisodes;
    });
  };

  const handleUpdateBeat = (beatIndex: number, text: string) => {
    const newBeats = [...currentEp.narrativeBeats];
    newBeats[beatIndex] = text;
    updateCurrentEpisode({ narrativeBeats: newBeats });
  };

  const handleAddBeat = () => {
    const newBeats = [...currentEp.narrativeBeats, "Nhịp kể mới..."];
    updateCurrentEpisode({ narrativeBeats: newBeats });
  };

  const handleDeleteBeat = (beatIndex: number) => {
    if (currentEp.narrativeBeats.length <= 1) {
      setErrorMsg("Mỗi tập cần có ít nhất 1 nhịp kể.");
      return;
    }
    const newBeats = currentEp.narrativeBeats.filter((_, idx) => idx !== beatIndex);
    updateCurrentEpisode({ narrativeBeats: newBeats });
    setErrorMsg(null);
  };

  const handleSaveAll = async () => {
    if (!seriesTitle.trim()) {
      setErrorMsg("Tên series podcast không được để trống.");
      return;
    }

    for (let i = 0; i < 3; i++) {
      const ep = episodes[i];
      if (!ep.episodeTitle.trim()) {
        setErrorMsg(`Tên của Tập ${i + 1} không được để trống.`);
        setActiveEpIndex(i as 0 | 1 | 2);
        return;
      }
      if (ep.narrativeBeats.length === 0 || ep.narrativeBeats.some((b) => !b.trim())) {
        setErrorMsg(`Tập ${i + 1} có nhịp kể để trống. Vui lòng nhập nội dung hoặc xóa nhịp thừa.`);
        setActiveEpIndex(i as 0 | 1 | 2);
        return;
      }
    }

    setErrorMsg(null);
    const updated: StoryOutline = {
      ...initialOutline,
      seriesTitle: seriesTitle.trim(),
      episodes: [
        { ...episodes[0], episodeTitle: episodes[0].episodeTitle.trim() },
        { ...episodes[1], episodeTitle: episodes[1].episodeTitle.trim() },
        { ...episodes[2], episodeTitle: episodes[2].episodeTitle.trim() },
      ],
    };

    await onSave(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="outline-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="space-y-1">
            <h2 id="outline-modal-title" className="text-base font-semibold text-foreground">
              Chỉnh sửa dàn ý kịch bản 3 tập
            </h2>
            <p className="text-xs text-muted-foreground">
              Tùy chỉnh tiêu đề tập, câu hỏi trung tâm và các nhịp kể phân cảnh
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tiêu đề Series & Tab chuyển tập */}
        <div className="border-b border-border/60 bg-muted/20 px-6 py-3 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <label className="text-xs font-medium text-muted-foreground shrink-0">
              Tên series podcast:
            </label>
            <input
              type="text"
              value={seriesTitle}
              onChange={(e) => setSeriesTitle(e.target.value)}
              className="h-8 flex-1 rounded-md border border-input bg-background px-3 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            {([0, 1, 2] as const).map((idx) => {
              const ep = episodes[idx];
              const isActive = activeEpIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setActiveEpIndex(idx);
                    setErrorMsg(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                  }`}
                >
                  <span>Tập {idx + 1}</span>
                  <span className="max-w-[120px] truncate text-[11px] opacity-80">
                    {ep.episodeTitle || "Chưa đặt tên"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alert lỗi */}
        {errorMsg && (
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Nội dung tập đang chọn */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Tiêu đề tập & Câu hỏi trung tâm */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tiêu đề tập {activeEpIndex + 1} *</label>
              <input
                type="text"
                value={currentEp.episodeTitle}
                onChange={(e) => updateCurrentEpisode({ episodeTitle: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Câu hỏi trung tâm của tập</label>
              <input
                type="text"
                value={currentEp.centralQuestion}
                onChange={(e) => updateCurrentEpisode({ centralQuestion: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Danh sách nhịp kể (Narrative Beats) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Các nhịp kể / Phân cảnh ({currentEp.narrativeBeats.length} nhịp)
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddBeat}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Plus className="size-3" />
                Thêm nhịp kể
              </Button>
            </div>

            <div className="space-y-2">
              {currentEp.narrativeBeats.map((beat, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-mono text-muted-foreground mt-1">
                    {bIdx + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={beat}
                    onChange={(e) => handleUpdateBeat(bIdx, e.target.value)}
                    className="flex-1 rounded-md border border-input bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBeat(bIdx)}
                    disabled={currentEp.narrativeBeats.length <= 1}
                    aria-label={`Xóa nhịp kể ${bIdx + 1}`}
                    className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-1 shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Đoạn kết nối / Hook kết tập */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Đoạn kết gây tò mò (Hook kết tập)</label>
            <textarea
              rows={2}
              value={currentEp.hookEnd}
              onChange={(e) => updateCurrentEpisode({ hookEnd: e.target.value })}
              placeholder="Câu hỏi mở hoặc tình tiết lửng tạo tò mò cho tập sau..."
              className="w-full rounded-md border border-input bg-background p-2 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Chu kỳ SPDC (Collapsible nâng cao) */}
          <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
            <button
              type="button"
              onClick={() => setIsSpdcOpen(!isSpdcOpen)}
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <span>Cấu trúc chu kỳ SPDC (Tình huống - Vấn đề - Quyết định - Hệ quả)</span>
              {isSpdcOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>

            {isSpdcOpen && (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-2 border-t border-border/40">
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Tình huống (Situation)</span>
                  <input
                    type="text"
                    value={currentEp.spdcCycle.situation}
                    onChange={(e) =>
                      updateCurrentEpisode({
                        spdcCycle: { ...currentEp.spdcCycle, situation: e.target.value },
                      })
                    }
                    className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Vấn đề (Problem)</span>
                  <input
                    type="text"
                    value={currentEp.spdcCycle.problem}
                    onChange={(e) =>
                      updateCurrentEpisode({
                        spdcCycle: { ...currentEp.spdcCycle, problem: e.target.value },
                      })
                    }
                    className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Quyết định (Decision)</span>
                  <input
                    type="text"
                    value={currentEp.spdcCycle.decision}
                    onChange={(e) =>
                      updateCurrentEpisode({
                        spdcCycle: { ...currentEp.spdcCycle, decision: e.target.value },
                      })
                    }
                    className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">Hệ quả (Consequence)</span>
                  <input
                    type="text"
                    value={currentEp.spdcCycle.consequence}
                    onChange={(e) =>
                      updateCurrentEpisode({
                        spdcCycle: { ...currentEp.spdcCycle, consequence: e.target.value },
                      })
                    }
                    className="h-7 w-full rounded border border-input bg-background px-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-6 py-3.5">
          <span className="text-xs text-muted-foreground">
            Đang chỉnh sửa Tập {activeEpIndex + 1}/3
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => void handleSaveAll()}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Check className="size-3.5" />
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
