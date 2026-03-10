"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CompactWizardHeaderProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  getStepStatus: (step: number) => "current" | "completed" | "incomplete";
  onStepClick: (step: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  // Save status
  isSaving?: boolean;
  isDirty?: boolean;
  lastSaved?: Date | null;
  className?: string;
}

export function CompactWizardHeader({
  currentStep,
  totalSteps,
  stepTitle,
  getStepStatus,
  onStepClick,
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
  isSaving = false,
  isDirty = false,
  lastSaved,
  className,
}: CompactWizardHeaderProps) {
  return (
    <div className={cn("bg-white", className)}>
      {/* Thin Progress Bar */}
      <div className="w-full h-1 bg-gray-200">
        <div className="flex h-full">
          {Array.from({ length: totalSteps }, (_, index) => {
            const step = index + 1;
            const status = getStepStatus(step);
            return (
              <div
                key={step}
                className={cn(
                  "flex-1 transition-colors duration-300",
                  status === "completed" && "bg-green-500",
                  status === "current" && "bg-primary",
                  status === "incomplete" && "bg-gray-200"
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Minimal Header Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Large Step Title */}
          <h1 className="text-2xl font-bold text-gray-900">{stepTitle}</h1>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1">
            {/* Previous button */}
            {onPrevious && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={!canGoPrevious}
                className="p-2 hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}

            {/* Next button */}
            {onNext && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNext}
                disabled={!canGoNext}
                className="p-2 hover:bg-gray-100"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}