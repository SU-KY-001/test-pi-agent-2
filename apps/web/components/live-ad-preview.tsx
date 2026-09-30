"use client";

import React, { useState } from "react";
import type { Advertisement, ContentPlan } from "@repo/contracts";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface LiveAdPreviewProps {
  ad: Advertisement | null;
  plan?: ContentPlan | null;
  version?: number | null;
}

export function LiveAdPreview({ ad, plan, version }: LiveAdPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!ad) return;
    const textToCopy = `${ad.headline}\n\n${ad.body}\n\n👉 ${ad.callToAction}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (!ad) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-card/40 min-h-[320px]">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3 text-xl">
          📢
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Chưa có bài viết quảng cáo</h4>
        <p className="text-xs text-muted-foreground max-w-[260px]">
          Bản xem trước trực quan sẽ tự động xuất hiện ngay khi Agent Writer hoàn thành bản thảo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bản xem trước bài viết
          </span>
          {version != null && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
              v{version}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="h-7 text-xs font-medium gap-1.5"
        >
          {copied ? (
            <>
              <span className="text-emerald-500">✓</span>
              <span>Đã sao chép</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Sao chép</span>
            </>
          )}
        </Button>
      </div>

      {/* Main card body */}
      <div className="p-6 space-y-4">
        {plan && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <Badge variant="outline" className="text-[11px] font-normal border-primary/30 bg-primary/5 text-primary">
              Tone: <span className="font-semibold ml-1 capitalize">{plan.tone}</span>
            </Badge>
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              Đối tượng: {plan.targetAudience}
            </Badge>
          </div>
        )}

        {/* Headline */}
        <div>
          <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground leading-snug">
            {ad.headline}
          </h3>
        </div>

        {/* Body Copy */}
        <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-muted/20 p-4 rounded-lg border border-border/50">
          {ad.body}
        </div>

        {/* Call to action */}
        <div className="pt-2">
          <div className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors w-full sm:w-auto">
            <span>{ad.callToAction}</span>
            <span className="ml-2">→</span>
          </div>
        </div>
      </div>
    </div>
  );
}
