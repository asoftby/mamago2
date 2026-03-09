"use client";

import { ContentStatus, type Place, type PlaceImage } from "@prisma/client";
import { Check, Loader2, Save, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlaceStatusBadge } from "@/components/business/place/PlaceStatusBadge";
import { computePlaceDraftCompletion } from "../utils/computeCompletion";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import Link from "next/link";

interface PlaceWithImages extends Place {
  images: PlaceImage[];
}

interface WizardHeaderNewProps {
  currentStep: number;
  totalSteps: number;
  status: ContentStatus;
  isSaving: boolean;
  isDirty?: boolean;
  lastSaved: Date | null;
  onStepClick: (step: number) => void;
  onSaveDraft?: () => void;
  canGoNext: boolean;
  getStepStatus: (step: number) => "done" | "current" | "available" | "locked";
  place: PlaceWithImages;
  hasActiveRevision?: boolean;
  revisionStatus?: string;
}

const STEP_LABELS = ["Профиль", "Локация", "Фото", "Контакты"];

export function WizardHeaderNew({
  currentStep,
  totalSteps,
  status,
  isSaving,
  isDirty = false,
  lastSaved,
  onStepClick,
  onSaveDraft,
  canGoNext,
  getStepStatus,
  place,
  hasActiveRevision,
  revisionStatus,
}: WizardHeaderNewProps) {
  const completion = computePlaceDraftCompletion(place);
  const publicUrl = getPlacePublicUrl(place);

  const handleStepClick = (step: number) => {
    const stepStatus = getStepStatus(step);
    
    if (stepStatus === "locked") {
      toast.error(`Заполните обязательные поля на шаге "${STEP_LABELS[currentStep - 1]}"`);
      return;
    }
    
    onStepClick(step);
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Top row: Title, Status Badge, Public Link, Save button, Save indicator */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-semibold">
              {place.title || "Создание места"}
            </h1>
            <PlaceStatusBadge
              status={status}
              hasActiveRevision={hasActiveRevision}
              revisionStatus={revisionStatus}
            />
            {/* Public URL link - only for published places with slug */}
            {publicUrl && (
              <Link
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Открыть на сайте</span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Save Draft Button */}
            {onSaveDraft && (
              <Button
                onClick={onSaveDraft}
                disabled={!isDirty || isSaving}
                variant="outline"
                size="sm"
                className={cn(
                  "transition-all",
                  isDirty && !isSaving && "border-primary text-primary hover:bg-primary/10"
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Сохранить черновик
                  </>
                )}
              </Button>
            )}

            {/* Save Status Indicator */}
            <div className="flex items-center gap-2 text-sm min-w-[120px]">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Сохраняю...</span>
                </>
              ) : isDirty ? (
                <span className="text-amber-600 font-medium">Не сохранено</span>
              ) : lastSaved ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">
                    {formatTime(lastSaved)}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Middle row: Clickable steps */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, index) => {
            const stepNumber = index + 1;
            const stepStatus = getStepStatus(stepNumber);
            const isCurrent = stepNumber === currentStep;
            const isDone = stepStatus === "done";
            const isLocked = stepStatus === "locked";

            return (
              <button
                key={stepNumber}
                onClick={() => handleStepClick(stepNumber)}
                disabled={isLocked}
                className={cn(
                  "flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  "border border-transparent",
                  isCurrent && "bg-primary text-primary-foreground shadow-sm",
                  isDone && !isCurrent && "bg-green-50 text-green-700 hover:bg-green-100",
                  !isCurrent && !isDone && !isLocked && "text-muted-foreground hover:bg-muted",
                  isLocked && "text-muted-foreground/50 cursor-not-allowed opacity-50"
                )}
              >
                <div className="flex items-center justify-center gap-2">
                  {isDone && !isCurrent && (
                    <Check className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{stepNumber}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {completion}%
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return "только что";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
