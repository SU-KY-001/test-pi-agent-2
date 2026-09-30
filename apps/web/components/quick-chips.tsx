"use client";

import React from "react";

interface QuickChipsProps {
  chips: string[];
  onSelect: (chip: string) => void;
  disabled?: boolean;
}

export function QuickChips({ chips, onSelect, disabled }: QuickChipsProps) {
  if (!chips || chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-xs text-muted-foreground font-medium">Gợi ý nhanh:</span>
      {chips.map((chip, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip)}
          className="inline-flex items-center rounded-md border border-border/80 bg-muted/60 px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
