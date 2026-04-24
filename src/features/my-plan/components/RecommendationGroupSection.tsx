"use client";

import { cn } from "@/lib/utils";

type RecommendationGroupSectionProps = {
  title: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
};

export function RecommendationGroupSection({
  title,
  children,
  compact = false,
}: RecommendationGroupSectionProps) {
  return (
    <section
      className={cn(
        "rounded-[26px] border border-neutral-200/80 bg-white/90 shadow-[0_12px_32px_-24px_rgba(17,24,39,0.3)]",
        compact ? "p-3.5" : "p-4",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
