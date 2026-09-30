"use client";

import React, { useState } from "react";
import type { StepType } from "@repo/contracts";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { QuickChips } from "./quick-chips";

interface ActionDeckProps {
  stepType: StepType;
  currentVersion: number;
  currentOutputJson?: unknown;
  onRerun: (feedback: string) => Promise<void>;
  onContinue: (version: number, guidance?: string) => Promise<void>;
  onDirectEdit?: (baseVersion: number, editedOutput: unknown, note?: string) => Promise<void>;
  isSubmitting: boolean;
}

export function ActionDeck({
  stepType,
  currentVersion,
  currentOutputJson,
  onRerun,
  onContinue,
  onDirectEdit,
  isSubmitting,
}: ActionDeckProps) {
  const [feedback, setFeedback] = useState("");
  const [guidance, setGuidance] = useState("");
  const [isEditingDirect, setIsEditingDirect] = useState(false);
  const [directJsonText, setDirectJsonText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Initialize direct edit textarea when toggled
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
      const parsed = JSON.parse(directJsonText);
      await onDirectEdit(currentVersion, parsed, "Chỉnh sửa trực tiếp từ giao diện");
      setIsEditingDirect(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "JSON không hợp lệ");
    }
  };

  const rerunChips =
    stepType === "PLANNER"
      ? [
          "Tập trung vào dân văn phòng",
          "Nhấn mạnh bảo hành và độ bền",
          "Đổi tone sang tối giản",
          "Tăng tính cấp bách",
          "Tạo góc nhìn độc lạ",
        ]
      : [
          "Ngắn gọn hơn nữa",
          "Headline giật gân hơn",
          "Đổi CTA kêu gọi mua ngay",
          "Nhấn mạnh giá và khuyến mãi",
          "Văn phong tinh tế hơn",
        ];

  const continueChips =
    stepType === "PLANNER"
      ? [
          "Viết bài ngắn dưới 100 từ",
          "Dùng tone hài hước nhẹ",
          "Nhấn mạnh tiêu chuẩn chất lượng",
          "Tránh dùng emoji",
        ]
      : [
          "Soi kỹ thông số kỹ thuật",
          "Kiểm tra kỹ các cam kết",
          "Đảm bảo không bị cường điệu",
        ];

  return (
    <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Duyệt kết quả bước {stepType} (Bản v{currentVersion})
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
            {isEditingDirect ? "Đóng chỉnh sửa" : "✏️ Sửa trực tiếp"}
          </Button>
        )}
      </div>

      {isEditingDirect ? (
        /* Direct In-Place Edit Form */
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Chỉnh sửa trực tiếp dữ liệu đầu ra:
            </span>
            <span className="text-[11px] text-muted-foreground">Định dạng JSON</span>
          </div>
          <Textarea
            value={directJsonText}
            onChange={(e) => setDirectJsonText(e.target.value)}
            disabled={isSubmitting}
            className="font-mono text-xs min-h-[180px] bg-muted/30"
          />
          {editError && (
            <p className="text-xs text-red-500 font-medium">⚠️ {editError}</p>
          )}
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
              onClick={handleSaveDirectEdit}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? "Đang lưu..." : "Lưu & Tiếp tục →"}
            </Button>
          </div>
        </div>
      ) : (
        /* 2-Column or Stacked HITL Deck */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: RERUN (Amber) */}
          <div className="rounded-lg border border-amber-300/60 dark:border-amber-900/60 bg-card p-4 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">🔄</span>
                <span className="text-xs font-semibold text-foreground">
                  Yêu cầu Agent viết lại
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Gửi phản hồi yêu cầu Agent tạo phiên bản mới v{currentVersion + 1}.
              </p>
              <Textarea
                placeholder="Nhập yêu cầu sửa đổi..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isSubmitting}
                className="text-xs min-h-[72px] resize-y bg-background"
              />
              <QuickChips
                chips={rerunChips}
                disabled={isSubmitting}
                onSelect={(chip) =>
                  setFeedback((prev) => (prev ? `${prev}, ${chip.toLowerCase()}` : chip))
                }
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting || !feedback.trim()}
              onClick={() => onRerun(feedback.trim())}
              className="w-full text-xs font-semibold border-amber-500/50 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300"
            >
              {isSubmitting ? "Đang gửi..." : "Gửi phản hồi & Sửa lại"}
            </Button>
          </div>

          {/* Card 2: CONTINUE (Emerald) */}
          <div className="rounded-lg border border-emerald-300/60 dark:border-emerald-900/60 bg-card p-4 flex flex-col justify-between space-y-3 shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">✅</span>
                <span className="text-xs font-semibold text-foreground">
                  Duyệt & Chuyển bước tiếp theo
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Chốt bản v{currentVersion} này và bắt đầu bước tiếp theo trong quy trình.
              </p>
              <Textarea
                placeholder="Lời dặn cho bước tiếp theo (tùy chọn)..."
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                disabled={isSubmitting}
                className="text-xs min-h-[72px] resize-y bg-background"
              />
              <QuickChips
                chips={continueChips}
                disabled={isSubmitting}
                onSelect={(chip) =>
                  setGuidance((prev) => (prev ? `${prev}, ${chip.toLowerCase()}` : chip))
                }
              />
            </div>
            <Button
              size="sm"
              disabled={isSubmitting}
              onClick={() => onContinue(currentVersion, guidance.trim() || undefined)}
              className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? "Đang xử lý..." : "Duyệt & Đi tiếp →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
