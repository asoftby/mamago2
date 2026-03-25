"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function PublicationStatsAccordionSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group overflow-hidden rounded-md border border-border/50 bg-white dark:bg-card",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-border/30 bg-white px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground dark:bg-card [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}
