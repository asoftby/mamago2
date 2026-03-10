"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  getStepStatus: (step: number) => "current" | "completed" | "incomplete";
  onStepClick: (step: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  getStepStatus,
  onStepClick,
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const stepStatus = getStepStatus(stepNumber);
        const isCurrent = stepNumber === currentStep;
        const isCompleted = stepStatus === "completed";
        const isIncomplete = stepStatus === "incomplete";

        return (
          <button
            key={stepNumber}
            onClick={() => onStepClick(stepNumber)}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all",
              "border border-transparent",
              // Current step - primary color
              isCurrent && "bg-primary text-primary-foreground shadow-sm border-primary",
              // Completed step - consistent green with checkmark
              isCompleted && !isCurrent && [
                "bg-green-50 text-green-700 border-green-200",
                "hover:bg-green-100 hover:border-green-300"
              ],
              // Incomplete step - neutral
              isIncomplete && !isCurrent && [
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "border-gray-200 hover:border-gray-300"
              ]
            )}
          >
            <div className="flex items-center justify-center gap-2">
              {isCompleted && !isCurrent && (
                <Check className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{stepNumber}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}