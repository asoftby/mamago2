"use client";

import type { BuilderStep } from "../types/builder";
import { BUILDER_STEP_ORDER, TOTAL_BUILDER_STEPS } from "../lib/stepOrder";
import { cn } from "@/lib/utils";

interface BuilderProgressProps {
  currentStep: BuilderStep;
  className?: string;
}

export function BuilderProgress({ currentStep, className = "" }: BuilderProgressProps) {
  const index = BUILDER_STEP_ORDER.indexOf(currentStep);
  const current = index >= 0 ? index + 1 : 1;

  return (
    <div className={cn("flex items-center gap-2 shrink-0", className)}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: TOTAL_BUILDER_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 shrink-0 rounded-full transition-all duration-200",
              i + 1 <= current ? "bg-[#EF8759]" : "bg-border"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
        Шаг {current} из {TOTAL_BUILDER_STEPS}
      </span>
    </div>
  );
}
