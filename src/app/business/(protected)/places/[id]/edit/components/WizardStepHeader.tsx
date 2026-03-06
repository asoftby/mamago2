"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onNext?: () => void;
  canBack?: boolean;
  canNext?: boolean;
  backLabel?: string;
  nextLabel?: string;
  isLastStep?: boolean;
  isSaving?: boolean;
  className?: string;
}

export function WizardStepHeader({
  title,
  subtitle,
  onBack,
  onNext,
  canBack = true,
  canNext = true,
  backLabel = "Назад",
  nextLabel = "Далее",
  isLastStep = false,
  isSaving = false,
  className,
}: WizardStepHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row items-start justify-between gap-4 mb-6", className)}>
      {/* Left: Title + Subtitle */}
      <div className="min-w-0 flex-1">
        <h2 className="text-3xl font-semibold">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-2 pt-1 w-full sm:w-auto sm:justify-end">
        {onBack && (
          <Button
            onClick={onBack}
            disabled={!canBack}
            variant="outline"
            size="default"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {backLabel}
          </Button>
        )}
        
        {onNext && (
          <Button
            onClick={onNext}
            disabled={!canNext || isSaving}
            size="default"
            className={cn(
              isLastStep && "bg-green-600 hover:bg-green-700"
            )}
          >
            {nextLabel}
            {isLastStep ? (
              <Send className="h-4 w-4 ml-1" />
            ) : (
              <ChevronRight className="h-4 w-4 ml-1" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
