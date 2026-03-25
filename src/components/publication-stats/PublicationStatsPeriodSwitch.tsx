"use client";

import { cn } from "@/lib/utils";
import {
  type PublicationStatsPeriod,
  PUBLICATION_STATS_PERIOD_LABEL_RU,
  PUBLICATION_STATS_PERIODS,
} from "@/lib/publication-stats/period";

export function PublicationStatsPeriodSwitch({
  value,
  onChange,
  disabled,
  className,
}: {
  value: PublicationStatsPeriod;
  onChange: (p: PublicationStatsPeriod) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 rounded-md border border-border/50 bg-muted/30 p-1 font-mono",
        className
      )}
      role="group"
      aria-label="Период агрегации"
    >
      {PUBLICATION_STATS_PERIODS.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className={cn(
              "rounded px-2 py-1 text-[10px] font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:text-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
          >
            {PUBLICATION_STATS_PERIOD_LABEL_RU[p]}
          </button>
        );
      })}
    </div>
  );
}
