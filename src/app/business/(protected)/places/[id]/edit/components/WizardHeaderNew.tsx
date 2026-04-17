"use client";

import { ContentStatus, type Place } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceStatusBadge } from "@/components/business/place/PlaceStatusBadge";
import { computePlaceDraftCompletion } from "../utils/computeCompletion";
import { getPlacePublicUrl } from "@/lib/placePublicUrl";
import { AutoSaveStatus } from "@/components/business/wizard/AutoSaveStatus";
import { StepIndicator } from "@/components/business/wizard/StepIndicator";
import Link from "next/link";

interface PlaceImage {
  id: string;
  createdAt: Date;
  url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  kind: string;
  sortOrder: number;
  placeId?: string;
  revisionId?: string;
}

interface PlaceWithImages extends Omit<Place, 'images'> {
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
  getStepStatus: (step: number) => "current" | "completed" | "incomplete";
  place: PlaceWithImages;
  hasActiveRevision?: boolean;
  revisionStatus?: string;
  saveError?: string | null;
}

// All 6 steps including review
const STEP_LABELS = ["Профиль", "Локация", "Фото", "Контакты", "Режим работы", "Проверка"];

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
  saveError,
}: WizardHeaderNewProps) {
  const completion = computePlaceDraftCompletion(place);
  const publicUrl = getPlacePublicUrl(place);

  // Map step status to new simplified naming
  const mapStepStatus = (step: number) => {
    return getStepStatus(step);
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Top row: Title, Status Badge, Public Link, Save Status */}
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

          <div className="flex items-center gap-4">
            {/* Silent autosave - only show errors */}
            <AutoSaveStatus
              isSaving={isSaving}
              isDirty={isDirty}
              lastSaved={lastSaved}
              error={saveError}
            />
          </div>
        </div>

        {/* Middle row: All 6 steps */}
        <StepIndicator
          steps={STEP_LABELS}
          currentStep={currentStep}
          getStepStatus={mapStepStatus}
          onStepClick={onStepClick}
          className="mb-3"
        />

        {/* Progress bar */}
        <div className="flex items-center gap-2">
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
