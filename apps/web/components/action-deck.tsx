"use client";

import React, { useState } from "react";
import type { StepType } from "@repo/contracts";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { QuickChips } from "./quick-chips";

const RERUN_CHIPS: Record<StepType, string[]> = {
  RESEARCHER: [
    "Bổ sung nguồn khảo cổ học cho giai đoạn này",
    "Ưu tiên tư liệu chính sử Tier 1",
    "Đề xuất thêm trọng tâm về nhân vật",
    "Làm rõ bối cảnh địa lý của trận địa",
    "Thêm câu hỏi nghiên cứu về hệ quả chính trị",
  ],
  SOURCE_EVALUATOR: [
    "Kiểm chứng chéo kỹ hơn giữa Tier 1 và Tier 4",
    "Gắn cờ các nguồn có dấu hiệu echo chamber",
    "Loại bỏ nguồn thiếu căn cứ khảo cổ",
    "So sánh dị bản chép tay giữa các bộ sử",
  ],
  FACT_EXTRACTOR: [
    "Tách thêm fact card về niên đại và địa danh",
    "Ghi rõ đoạn trích dẫn cho từng fact card",
    "Điền các khoảng trống sử liệu còn thiếu",
    "Bổ sung fact card về nhân vật phản trắc",
  ],
  STORY_PLANNER: [
    "Nhấn mạnh cơ chế bãi cọc 45 độ và biên độ thủy triều 3-4m",
    "Làm rõ sự cô lập và động cơ phản trắc của Kiều Công Tiễn",
    "Tập trung vào cuộc chạy đua thời gian từ Ái Châu ra Đại La",
    "Bám sát tư liệu khảo cổ thay vì dã sử",
    "Siết chặt hook kết mỗi tập",
  ],
  SCRIPT_WRITER: [
    "Làm mềm câu văn, chêm thêm liên từ nối chuyển ý",
    "Cắt bỏ các chi tiết suy đoán cảm xúc nội tâm nhân vật",
    "Giữ câu dài vừa phải để dễ đọc TTS",
    "Tăng cảm giác căng thẳng ở cao trào tập 3",
  ],
  ORALIZER: [
    "Rút gọn câu còn dưới 25 từ",
    "Xóa toàn bộ dấu gạch ngang và dấu hai chấm",
    "Thêm liên từ nối ở đầu các chuyển ý",
    "Điều chỉnh nhịp lấy hơi ở phân đoạn dài",
  ],
  FACT_CHECKER: [
    "Kiểm lại các claim không có fact card đối chiếu",
    "Siết tiêu chí: không suy đoán nội tâm nhân vật",
    "Đối chiếu lại số liệu thủy triều và địa danh",
  ],
};

const CONTINUE_CHIPS: Record<StepType, string[]> = {
  RESEARCHER: [
    "Bám sát trọng tâm kể đã chọn",
    "Giữ giọng kể trung tính",
    "Ưu tiên Tier 1 khi nguồn mâu thuẫn",
  ],
  SOURCE_EVALUATOR: [],
  FACT_EXTRACTOR: [],
  STORY_PLANNER: [
    "Mỗi tập giữ một hook kết rõ ràng",
    "Không vượt 4.500 từ mỗi tập",
    "Mở đầu tập 2 nối tiếp cliffhanger tập 1",
  ],
  SCRIPT_WRITER: [],
  ORALIZER: [],
  FACT_CHECKER: [],
};

interface ActionDeckProps {
  stepType: StepType;
  currentVersion: number;
  currentOutputJson?: unknown;
  onRerun: (feedback: string) => Promise<void>;
  /** Bỏ trống khi hành động duyệt do card chuyên biệt đảm nhiệm (Gate 0). */
  onContinue?: (version: number, guidance?: string) => Promise<void>;
  onDirectEdit?: (baseVersion: number, editedOutput: unknown, note?: string) => Promise<void>;
  isSubmitting: boolean;
  continueLabel?: string;
}

export function ActionDeck({
  stepType,
  currentVersion,
  currentOutputJson,
  onRerun,
  onContinue,
  onDirectEdit,
  isSubmitting,
  continueLabel = "Duyệt & Đi tiếp →",
}: ActionDeckProps) {
  const [feedback, setFeedback] = useState("");
  const [guidance, setGuidance] = useState("");
  const [isEditingDirect, setIsEditingDirect] = useState(false);
  const [directJsonText, setDirectJsonText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const handleToggleDirectEdit = () => {
    if (!isEditingDirect) {
      setDirectJsonText(JSON.stringify(currentOutputJson, null, 2));
      setEditError(null);
    }
    setIsEditingDirect(!isEditingDirect);
  };

  const handleSaveDirectEdit = async () => {
    if (!onDirectEdit) return;
    try {
      setEditError(null);
      const parsed: unknown = JSON.parse(directJsonText);
      await onDirectEdit(currentVersion, parsed, "Chỉnh sửa trực tiếp từ giao diện");
      setIsEditingDirect(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "JSON không hợp lệ");
    }
  };

  const rerunChips = RERUN_CHIPS[stepType];
  const continueChips = CONTINUE_CHIPS[stepType];

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-2.5 rounded-full bg-amber-500 animate-pulse" aria-hidden />
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {onContinue
              ? `Duyệt kết quả ${stepType} (bản v${currentVersion})`
              : `Chạy lại nhánh mới cho ${stepType} (bản v${currentVersion})`}
          </h4>
        </div>
        {onDirectEdit && (
          <Button
            size="sm"
            variant="outline"
            disabled={isSubmitting}
            onClick={handleToggleDirectEdit}
            className="h-7 text-xs font-medium"
          >
            {isEditingDirect ? "Đóng chỉnh sửa" : "✏️ Sửa trực tiếp JSON"}
          </Button>
        )}
      </div>

      {isEditingDirect ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Chỉnh sửa trực tiếp dữ liệu đầu ra</span>
            <span className="text-[11px] text-muted-foreground">Định dạng JSON (kiểm tra bằng JSON.parse)</span>
          </div>
          <Textarea
            value={directJsonText}
            onChange={(event) => setDirectJsonText(event.target.value)}
            disabled={isSubmitting}
            className="min-h-[180px] bg-muted/30 font-mono text-xs"
          />
          {editError && <p className="text-xs font-medium text-red-500">⚠️ {editError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsEditingDirect(false)}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => void handleSaveDirectEdit()}
              className="h-8 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
            >
              {isSubmitting ? "Đang lưu…" : "Lưu bản chỉnh sửa (v" + (currentVersion + 1) + ")"}
            </Button>
          </div>
        </div>
      ) : (
        <div className={onContinue ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4"}>
          <div className="flex flex-col justify-between space-y-3 rounded-lg border border-amber-300/60 bg-card p-4 shadow-xs dark:border-amber-900/60">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm" aria-hidden>
                  🔄
                </span>
                <span className="text-xs font-semibold text-foreground">Tạo nhánh mới từ node này</span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Fork một node anh em v{currentVersion + 1} từ cùng node cha; các bước phía sau sẽ bị đánh dấu đã cũ.
              </p>
              <Textarea
                placeholder="Nhập phản hồi / lời dặn cho lần chạy lại…"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={isSubmitting}
                className="min-h-[72px] resize-y bg-background text-xs"
              />
              <QuickChips
                chips={rerunChips}
                disabled={isSubmitting}
                onSelect={(chip) => setFeedback((prev) => (prev ? `${prev}, ${chip.toLowerCase()}` : chip))}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting || !feedback.trim()}
              onClick={() => void onRerun(feedback.trim())}
              className="w-full border-amber-500/50 text-xs font-semibold text-amber-800 hover:bg-amber-500/10 dark:text-amber-300"
            >
              {isSubmitting ? "Đang gửi…" : "Gửi phản hồi & chạy lại nhánh mới"}
            </Button>
          </div>

          {onContinue && (
            <div className="flex flex-col justify-between space-y-3 rounded-lg border border-emerald-300/60 bg-card p-4 shadow-xs dark:border-emerald-900/60">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm" aria-hidden>
                    ✅
                  </span>
                  <span className="text-xs font-semibold text-foreground">Duyệt &amp; chuyển bước</span>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Chốt bản v{currentVersion} và cho pipeline 7 bước chạy tiếp.
                </p>
                <Textarea
                  placeholder="Lời dặn kèm cho bước tiếp theo (tùy chọn)…"
                  value={guidance}
                  onChange={(event) => setGuidance(event.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[72px] resize-y bg-background text-xs"
                />
                <QuickChips
                  chips={continueChips}
                  disabled={isSubmitting}
                  onSelect={(chip) => setGuidance((prev) => (prev ? `${prev}, ${chip.toLowerCase()}` : chip))}
                />
              </div>
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={() => void onContinue(currentVersion, guidance.trim() || undefined)}
                className="w-full bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {isSubmitting ? "Đang xử lý…" : continueLabel}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
