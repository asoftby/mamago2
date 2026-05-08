"use client";

import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { validateForSubmit, validateStep } from "../validation";
import { EVENT_WIZARD_STEPS, buildReviewSections } from "../eventWizardSteps.config";
import type { EventFormData } from "../types";

interface Step9ReviewProps {
  data: EventFormData;
  isSubmitting: boolean;
  submitStatus?: "idle" | "validating" | "submitting" | "success" | "error";
  onGoToStep?: (step: number) => void;
}

export function Step9Review({ data, isSubmitting, submitStatus = "idle", onGoToStep }: Step9ReviewProps) {
  const submitValidation = validateForSubmit(data);
  
  // Don't show validation errors after successful submit
  const showValidationErrors = submitStatus !== "success";
  
  // Build review sections from config
  const reviewSections = buildReviewSections(EVENT_WIZARD_STEPS, data, validateStep);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Проверка и отправка</h2>
        <p className="text-[12px] text-muted-foreground">
          Проверьте все данные перед отправкой на модерацию
        </p>
      </div>

      {/* Validation Status */}
      {showValidationErrors && !submitValidation.isValid && (
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

      {showValidationErrors && submitValidation.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-900 font-medium">
              Всё окей. Публикация готова к отправке!
            </p>
          </div>
        </div>
      )}
      
      {submitStatus === "success" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-900 font-medium">
              Событие успешно опубликовано!
            </p>
          </div>
        </div>
      )}

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
                <div className="text-[12px] text-muted-foreground space-y-1">
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
              
              {onGoToStep && !section.isComplete && submitStatus !== "success" && (
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
