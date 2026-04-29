"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface WizardProgressStep {
  id: number;
  label: string;
  isComplete?: boolean;
}

interface WizardProgressProps {
  steps: WizardProgressStep[];
  currentStep: number;
  onStepChange: (stepId: number) => void;
  className?: string;
}

export function WizardProgress({
  steps,
  currentStep,
  onStepChange,
  className,
}: WizardProgressProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentStep]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Шаги"
      className={cn("no-scrollbar flex w-full overflow-x-auto", className)}
    >
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isDone = !!step.isComplete;

        return (
          <button
            key={step.id}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onStepChange(step.id)}
            className={cn(
              "group relative flex flex-1 flex-col items-center gap-1.5",
              "cursor-pointer select-none pb-3 pt-1",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF8759]/40 focus-visible:ring-offset-1",
            )}
          >
            {/* Label */}
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap transition-colors duration-150",
                isActive
                  ? "text-[#EF8759]"
                  : isDone
                    ? "text-gray-700 group-hover:text-gray-900"
                    : "text-gray-400 group-hover:text-gray-600",
              )}
            >
              {step.label}
            </span>

            {/* Step dot */}
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-200",
                isActive
                  ? "bg-[#EF8759] text-white ring-2 ring-[#EF8759]/30"
                  : isDone
                    ? "bg-[#EF8759] text-white"
                    : "bg-gray-100 text-gray-400 group-hover:bg-gray-200",
              )}
            >
              {step.id}
            </span>

            {/* Underline */}
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200",
                isActive
                  ? "bg-[#EF8759]"
                  : isDone
                    ? "bg-gray-200 group-hover:bg-gray-300"
                    : "bg-transparent group-hover:bg-gray-100",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
