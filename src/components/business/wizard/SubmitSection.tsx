"use client";

import { useState } from "react";
import { Send, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitSectionProps {
  place: any;
  openingHoursData: any;
  onSubmit: () => void;
  isSaving: boolean;
  isEditable: boolean;
  isRevisionMode?: boolean;
  revisionStatus?: string;
  hasChanges?: boolean;
  className?: string;
}

interface StepCompletionStatus {
  step: string;
  label: string;
  isCompleted: boolean;
  isRequired: boolean;
}

export function SubmitSection({
  place,
  openingHoursData,
  onSubmit,
  isSaving,
  isEditable,
  isRevisionMode = false,
  revisionStatus,
  hasChanges = false,
  className,
}: SubmitSectionProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculate completion status for each step
  const getStepCompletionStatus = (): StepCompletionStatus[] => {
    return [
      {
        step: "profile",
        label: "Профиль",
        isCompleted: !!(
          place.title &&
          place.category &&
          place.shortDesc &&
          place.description &&
          place.ageTags?.length > 0 &&
          place.visitFormats?.length > 0 &&
          place.activityTypes?.length > 0
        ),
        isRequired: true,
      },
      {
        step: "location",
        label: "Локация",
        isCompleted: !!(place.lat && place.lng),
        isRequired: true,
      },
      {
        step: "photos",
        label: "Фото",
        isCompleted: !!(place.logoImageId || place.images?.length > 0),
        isRequired: true,
      },
      {
        step: "contacts",
        label: "Контакты",
        isCompleted: !!(place.phone || place.website || place.instagramHandle),
        isRequired: false,
      },
      {
        step: "openingHours",
        label: "Режим работы",
        isCompleted: !!openingHoursData,
        isRequired: false,
      },
    ];
  };

  const stepStatuses = getStepCompletionStatus();
  const requiredSteps = stepStatuses.filter(s => s.isRequired);
  const allRequiredCompleted = requiredSteps.every(s => s.isCompleted);
  const canSubmit = allRequiredCompleted && isEditable && !isSaving;

  const getSubmitButtonText = () => {
    if (isSaving) return "Отправляю...";
    if (isRevisionMode) return "Отправить изменения на модерацию";
    return "Отправить на модерацию";
  };

  const getInfoText = () => {
    if (!isEditable) {
      return "Место находится на модерации. Редактирование заблокировано до проверки.";
    }
    
    if (isRevisionMode) {
      return "Проверьте изменения и отправьте их на модерацию. После отправки редактирование будет заблокировано до проверки.";
    }
    
    return "Проверьте информацию и отправьте место на модерацию. После отправки редактирование будет заблокировано до проверки.";
  };

  return (
    <div className={cn("border-t-2 border-dashed border-gray-200 mt-8 pt-8", className)}>
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-4">
          <Send className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">
            {isRevisionMode ? "Отправка изменений" : "Отправка на модерацию"}
          </h2>
        </div>

        {/* Info message */}
        <div className={cn(
          "p-4 rounded-lg mb-6",
          isEditable ? "bg-blue-50 border border-blue-200" : "bg-amber-50 border border-amber-200"
        )}>
          <div className="flex items-start gap-3">
            {isEditable ? (
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            )}
            <p className={cn(
              "text-sm",
              isEditable ? "text-blue-800" : "text-amber-800"
            )}>
              {getInfoText()}
            </p>
          </div>
        </div>

        {/* Completion summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">Готовность к отправке</h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-primary hover:text-primary/80"
            >
              {showDetails ? "Скрыть детали" : "Показать детали"}
            </button>
          </div>

          {showDetails && (
            <div className="space-y-2">
              {stepStatuses.map((status) => (
                <div key={status.step} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    {status.isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                    <span className="text-sm text-gray-700">{status.label}</span>
                    {!status.isRequired && (
                      <span className="text-xs text-gray-500">(необязательно)</span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    status.isCompleted ? "text-green-600" : "text-gray-500"
                  )}>
                    {status.isCompleted ? "Заполнено" : "Не заполнено"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!showDetails && (
            <div className="text-sm text-gray-600">
              {allRequiredCompleted ? (
                <span className="text-green-600 font-medium">
                  ✓ Все обязательные разделы заполнены
                </span>
              ) : (
                <span className="text-amber-600 font-medium">
                  ⚠ Заполните обязательные разделы для отправки
                </span>
              )}
            </div>
          )}
        </div>

        {/* Submit button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={onSubmit}
            disabled={!canSubmit}
            size="lg"
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {getSubmitButtonText()}
          </Button>

          {!allRequiredCompleted && (
            <p className="text-sm text-amber-600">
              Заполните обязательные разделы
            </p>
          )}
        </div>

        {/* Additional info for revision mode */}
        {isRevisionMode && hasChanges && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <FileText className="h-4 w-4 inline mr-1" />
              Обнаружены изменения в опубликованном месте. 
              После одобрения модератором изменения будут применены к публичной версии.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}