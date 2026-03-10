"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardFooterProps {
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  nextLabel?: string;
  isLastStep?: boolean;
  isSubmitting?: boolean;
  className?: string;
}

export function WizardFooter({
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
  nextLabel,
  isLastStep = false,
  isSubmitting = false,
  className,
}: WizardFooterProps) {
  const defaultNextLabel = isLastStep ? "Отправить на модерацию" : "Далее";
  const buttonLabel = nextLabel || defaultNextLabel;

  return (
    <div className={cn("flex items-center justify-between pt-8 border-t", className)}>
      {/* Previous button */}
      {onPrevious ? (
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </Button>
      ) : (
        <div /> // Spacer
      )}

      {/* Next/Submit button */}
      {onNext && (
        <Button
          onClick={onNext}
          disabled={!canGoNext || isSubmitting}
          className="flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {isLastStep ? "Отправляем..." : "Сохраняем..."}
            </>
          ) : (
            <>
              {buttonLabel}
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </>
          )}
        </Button>
      )}
    </div>
  );
}