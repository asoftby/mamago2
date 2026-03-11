"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Send, Clock } from "lucide-react";
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
  isPending?: boolean;
  hasNoChanges?: boolean;
  className?: string;
  currentStep?: number;
  totalSteps?: number;
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
  isPending = false,
  hasNoChanges = false,
  className,
  currentStep,
  totalSteps,
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
      <div className="flex flex-col items-end gap-2 pt-1 w-full sm:w-auto">
        <div className="flex items-center gap-3 w-full sm:w-auto">
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
          
          {/* Step Counter - show for each step */}
          {(currentStep !== undefined && totalSteps !== undefined) ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                {currentStep}/{totalSteps}
              </span>
            </div>
          ) : title === "Профиль места" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                1/6
              </span>
            </div>
          ) : title === "Локация" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                2/6
              </span>
            </div>
          ) : title === "Фотографии" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                3/6
              </span>
            </div>
          ) : title === "Контакты" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                4/6
              </span>
            </div>
          ) : title === "Режим работы" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                5/6
              </span>
            </div>
          ) : title === "Проверка и отправка" ? (
            <div className="flex items-center px-3 py-1 bg-muted rounded-md">
              <span className="text-sm font-medium text-muted-foreground">
                6/6
              </span>
            </div>
          ) : null}
          
          {onNext && (
            <Button
              onClick={onNext}
              disabled={!canNext || isSaving}
              size="default"
              variant={isPending ? "secondary" : hasNoChanges ? "outline" : "default"}
              className={cn(
                isLastStep && !isPending && !hasNoChanges && "bg-green-600 hover:bg-green-700",
                hasNoChanges && "cursor-not-allowed opacity-60"
              )}
            >
              {isPending && <Clock className="h-4 w-4 mr-1" />}
              {nextLabel}
              {isLastStep && !isPending && !hasNoChanges ? (
                <Send className="h-4 w-4 ml-1" />
              ) : !isPending && !hasNoChanges && (
                <ChevronRight className="h-4 w-4 ml-1" />
              )}
            </Button>
          )}
        </div>
        
        {/* Hint when no changes */}
        {hasNoChanges && isLastStep && (
          <p className="text-xs text-muted-foreground">
            Нет изменений для отправки
          </p>
        )}
      </div>
    </div>
  );
}
