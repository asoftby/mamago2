// Step 8: Review
// Inherits Event Wizard Step9Review pattern

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Edit } from "lucide-react";
import { OFFER_WIZARD_STEPS, buildReviewSections } from "../offerWizardSteps.config";
import { validateStep } from "../validation";
import type { OfferFormData } from "../types";

interface Step8ReviewProps {
  data: OfferFormData;
  isSubmitting: boolean;
  onGoToStep: (step: number) => void;
}

export function Step8Review({ data, isSubmitting, onGoToStep }: Step8ReviewProps) {
  // Build review sections from step configs
  const reviewSections = buildReviewSections(OFFER_WIZARD_STEPS, data, validateStep);
  
  // Calculate completion stats
  const totalSections = reviewSections.length;
  const completedSections = reviewSections.filter(section => section.isComplete).length;
  const completionPercentage = Math.round((completedSections / totalSections) * 100);
  
  // Get all missing fields
  const allMissingFields = reviewSections.flatMap(section => section.missingFields);
  const hasErrors = reviewSections.some(section => section.errors && section.errors.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Проверка предложения</h2>
        <p className="text-muted-foreground">
          Проверьте все данные перед отправкой на модерацию
        </p>
      </div>

      {/* Completion Progress */}
      <Card className={completionPercentage === 100 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {completionPercentage === 100 ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {completionPercentage === 100 ? "Предложение готово к отправке" : "Заполните недостающие поля"}
                </span>
                <span className="text-sm font-medium">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    completionPercentage === 100 ? "bg-green-600" : "bg-yellow-600"
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              {allMissingFields.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground mb-1">Не заполнено:</p>
                  <div className="flex flex-wrap gap-1">
                    {allMissingFields.slice(0, 6).map((field, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                    {allMissingFields.length > 6 && (
                      <Badge variant="secondary" className="text-xs">
                        +{allMissingFields.length - 6} еще
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Sections */}
      <div className="space-y-4">
        {reviewSections.map((section) => (
          <Card key={section.stepId} className={section.isComplete ? "" : "border-yellow-200"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {section.isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onGoToStep(section.stepId)}
                  disabled={isSubmitting}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Изменить
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Summary Items */}
              <div className="space-y-2">
                {section.summary.map((item, index) => (
                  <div key={index} className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}:</span>
                    <div className="text-sm text-right max-w-xs">
                      {item.isMissing ? (
                        <span className="text-yellow-600">{item.value}</span>
                      ) : (
                        <span>{item.value}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Errors */}
              {section.errors && section.errors.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800 mb-1">Ошибки:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {section.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {section.warnings && section.warnings.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Рекомендации:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {section.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Final Status */}
      {completionPercentage === 100 && !hasErrors && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-medium text-green-900 mb-1">Предложение готово!</h3>
            <p className="text-sm text-green-700">
              Все обязательные поля заполнены. Вы можете отправить предложение на модерацию.
            </p>
          </CardContent>
        </Card>
      )}

      {(completionPercentage < 100 || hasErrors) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 text-center">
            <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
            <h3 className="font-medium text-yellow-900 mb-1">Требуется доработка</h3>
            <p className="text-sm text-yellow-700">
              Заполните все обязательные поля и исправьте ошибки перед отправкой.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}