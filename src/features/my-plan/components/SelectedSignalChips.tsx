"use client";

import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";
import { cn } from "@/lib/utils";

export function SelectedSignalChips({
  signals,
  compact,
}: {
  signals: PlanOnboardingSignalChip[];
  compact?: boolean;
}) {
  if (signals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map((signal) => (
        <span
          key={signal.id}
          className={cn(
            "inline-flex max-w-full items-center rounded-full border border-neutral-200 bg-[#FAF7F1] px-2.5 py-1 font-medium text-neutral-700",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          {signal.icon ? (
            <span className="mr-1" aria-hidden>
              {signal.icon}
            </span>
          ) : null}
          <span className="truncate">{signal.title}</span>
        </span>
      ))}
    </div>
  );
}
