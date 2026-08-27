"use client";

import type { JobKeyword } from "@/lib/job-assistance/types";

interface MissingKeywordsProps {
  keywords: JobKeyword[];
  onToggle: (keyword: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Chip-style checkboxes that wrap horizontally, instead of a vertical list. */
export default function MissingKeywords({ keywords, onToggle, disabled = false, className }: MissingKeywordsProps) {
  if (keywords.length === 0) return null;

  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-muted">Missing keywords</label>
      <div className="flex flex-wrap gap-2">
        {keywords.map((k) => (
          <label
            key={k.keyword}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
              k.include ? "border-sage bg-sage/10 text-ink" : "border-input-border bg-white text-ink"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              checked={k.include}
              disabled={disabled}
              onChange={() => onToggle(k.keyword)}
              className="h-3.5 w-3.5 accent-sage"
            />
            {k.keyword}
          </label>
        ))}
      </div>
    </div>
  );
}
