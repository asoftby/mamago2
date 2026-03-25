"use client";

import { cn } from "@/lib/utils";
import type { EventPageFactChip } from "@/lib/event/eventPageTypes";

export function EventFactsChips({
  chips,
  className,
}: {
  chips: EventPageFactChip[];
  className?: string;
}) {
  if (!chips.length) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        className
      )}
    >
      {chips.map((c) => (
        <span
          key={c.id}
          className="inline-flex max-w-full items-center rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium text-foreground/90"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
