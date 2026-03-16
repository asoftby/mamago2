"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { validateForSubmit, validateStep } from "../validation";
import { PLACE_WIZARD_STEPS, buildReviewSections } from "../placeWizardSteps.config";
import { getPlaceCompletion, getCompletionMessage, getCompletionColor, getProgressBarColor } from "../completion";
import type { PlaceFormData } from "../types";

interface Step6ReviewProps {
  data: PlaceFormData;
  isSubmitting: boolean;
  onGoToStep?: (step: number) => void;
}

export function Step6Review({ data, isSubmitting, onGoToStep }: Step6ReviewProps) {
  const submitValidation = validateForSubmit(data);
  const completion = getPlaceCompletion(data);
  
  // Adapter function to convert StepValidation to StepValidationResult
  const adaptValidateStep = (stepId: number, data: PlaceFormData) => {
    const validation = validateStep(stepId, data);
    return {
      ...validation,
      warnings: [], // Place wizard doesn't have warnings, so add empty array
      missingFields: validation.errors, // Use errors as missing fields
    };
  };
  
  // Build review sections from config
  const reviewSections = buildReviewSections(PLACE_WIZARD_STEPS, data, adaptValidateStep);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Проверка и отправка</h2>
        <p className="text-sm text-muted-foreground">
          Проверьте все данные перед отправкой на модерацию
        </p>
      </div>

      {/* Validation Status */}
      {!submitValidation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-2">
                Не все обязательные поля заполнены
              </h3>
              <ul className="text-sm text-red-700 space-y-1">
                {submitValidation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {submitValidation.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-900 font-medium">
              Все обязательные поля заполнены. Место готово к отправке!
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Полнота заполнения</h3>
          <span className={`text-sm font-medium ${getCompletionColor(completion.percent)}`}>
            {completion.percent}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(completion.percent)}`}
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        
        <p className={`text-sm ${getCompletionColor(completion.percent)}`}>
          {getCompletionMessage(completion.percent)}
        </p>
        
        {completion.missingFields.length > 0 && completion.percent < 100 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Для улучшения карточки добавьте:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {completion.missingFields.slice(0, 6).map((field) => (
                <span
                  key={field.field}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-default"
                >
                  {field.label}
                </span>
              ))}
              {completion.missingFields.length > 6 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                  +{completion.missingFields.length - 6}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step Summary (Config-Driven) */}
      <div className="space-y-3">
        <h3 className="font-medium">Сводка по шагам</h3>
        
        {reviewSections.map((section) => (
          <div
            key={section.stepId}
            className={`border rounded-lg p-4 ${
              section.isComplete ? "bg-white" : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {section.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                  <h4 className="font-medium">Шаг {section.stepId}: {section.title}</h4>
                </div>
                
                {/* Step Content Summary from Config */}
                <div className="text-sm text-muted-foreground space-y-1">
                  {section.summary.map((item, index) => (
                    <p key={index}>
                      {item.label}: {item.value}
                    </p>
                  ))}
                </div>
                
                {/* Errors */}
                {section.errors && section.errors.length > 0 && (
                  <div className="mt-2 text-sm text-red-600">
                    {section.errors.map((error, index) => (
                      <p key={index}>• {error}</p>
                    ))}
                  </div>
                )}
                
                {/* Warnings */}
                {section.warnings && section.warnings.length > 0 && (
                  <div className="mt-2 text-sm text-yellow-600">
                    {section.warnings.map((warning, index) => (
                      <p key={index}>• {warning}</p>
                    ))}
                  </div>
                )}
              </div>
              
              {onGoToStep && !section.isComplete && (
                <button
                  type="button"
                  onClick={() => onGoToStep(section.stepId)}
                  className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
                >
                  Перейти
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
