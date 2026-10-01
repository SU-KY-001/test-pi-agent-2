"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, FileText } from "lucide-react";
import type { OralizedScript } from "@repo/contracts";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} phút` : `${minutes} phút ${rest} giây`;
}

export function formatWordCount(words: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(words)} từ`;
}

export interface LivePodcastPreviewProps {
  script: OralizedScript | null;
  version?: number | null;
  /** Kết quả linter ký tự cấm từ bước Kiểm định (null = chưa kiểm). */
  lintClean?: boolean | null;
  published?: boolean;
  publicationId?: number | null;
}

export function LivePodcastPreview({
  script,
  version = null,
  lintClean = null,
  published = false,
  publicationId = null,
}: LivePodcastPreviewProps) {
  const [episodeIndex, setEpisodeIndex] = useState(0);

  useEffect(() => {
    setEpisodeIndex(0);
  }, [script?.seriesTitle]);

  if (!script) {
    return (
      <Card className="border-dashed">
        <CardHeader className="items-center p-6 text-center">
          <FileText className="size-8 text-muted-foreground/60" aria-hidden />
          <CardTitle className="text-sm font-semibold">Chưa có kịch bản văn nói</CardTitle>
          <CardDescription className="max-w-md text-xs">
            Bản xem trước xuất hiện sau khi bước 6 “Chuyển thể văn nói” hoàn tất với đủ 3 tập.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const safeIndex = Math.min(episodeIndex, script.episodes.length - 1);
  const episode = script.episodes[safeIndex] ?? script.episodes[0];
  const totalDuration = script.episodes.reduce((sum, item) => sum + item.estimatedDurationSeconds, 0);

  return (
    <Card className={cn("border shadow-xs", published && "border-emerald-500/40")}>
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold">{script.seriesTitle}</CardTitle>
            <CardDescription className="text-xs">
              {formatWordCount(script.totalWordCount)} · {formatDuration(totalDuration)} · 3 tập
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {version != null && (
              <Badge variant="outline" className="font-mono text-[10px]">
                v{version}
              </Badge>
            )}
            {published && (
              <Badge className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">
                <CheckCircle2 className="size-3" aria-hidden />
                Đã xuất bản{publicationId != null ? ` #${publicationId}` : ""}
              </Badge>
            )}
            {lintClean != null && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  lintClean
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                )}
              >
                {lintClean ? "Text-for-Ear hợp lệ" : "Còn lỗi văn nói"}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Chọn tập podcast">
          {script.episodes.map((item, index) => (
            <Button
              key={item.episodeNumber}
              size="sm"
              role="tab"
              aria-selected={index === safeIndex}
              variant={index === safeIndex ? "default" : "outline"}
              onClick={() => setEpisodeIndex(index)}
              className="h-7 flex-1 gap-1 text-[11px] font-medium"
            >
              Tập {item.episodeNumber}
              <span className="hidden font-mono text-[10px] opacity-70 sm:inline">
                {formatDuration(item.estimatedDurationSeconds)}
              </span>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-1">
        <div>
          <h4 className="text-xs font-bold text-foreground">{episode.episodeTitle}</h4>
          <p className="text-[11px] text-muted-foreground">
            {formatWordCount(episode.wordCount)} · {formatDuration(episode.estimatedDurationSeconds)}
          </p>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3">
          <p className="whitespace-pre-line text-xs leading-relaxed text-foreground/90">{episode.spokenNarration}</p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
          <Activity className="mt-0.5 size-3.5 shrink-0 text-sky-400" aria-hidden />
          <div className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-sky-300">Ghi chú nhịp thở và tốc độ đọc: </span>
            {episode.breathAndPacingNotes}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
