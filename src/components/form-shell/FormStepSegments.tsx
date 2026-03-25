"use client";

import { cn } from "@/lib/utils";
import type { FormWizardSegment } from "./types";

interface FormStepSegmentsProps {
  segments: FormWizardSegment[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
  className?: string;
}

/**
 * Compact linear progress: one segment per step (including review).
 */
export function FormStepSegments({
  segments,
  currentStep,
  onStepClick,
  className,
}: FormStepSegmentsProps) {
  return (
    <div className={cn("flex gap-1.5 sm:gap-2", className)} role="tablist" aria-label="Steps">
      {segments.map((seg) => {
        const isCurrent = seg.id === currentStep;
        const isDone = seg.id < currentStep;
        return (
          <button
            key={seg.id}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            title={seg.title}
            onClick={() => onStepClick(seg.id)}
            className={cn(
              "h-2 min-w-0 flex-1 rounded-full transition-colors",
              isCurrent && "bg-primary",
              !isCurrent && isDone && "bg-primary/50",
              !isCurrent && !isDone && "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}
