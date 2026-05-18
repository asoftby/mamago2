// Step 8/9: Review
// Refactored for new step configuration system

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Edit } from "lucide-react";
import { getStepsForOfferType, isStepComplete, getMissingFieldsForStep, getStepNumber } from "../offerWizardSteps.config";
import type { OfferFormData, OfferWizardStepKey } from "../types";
import type { ValidationResult } from "../validation";

interface Step8ReviewProps {
  data: OfferFormData;
  isSubmitting: boolean;
  onGoToStep: (step: number) => void;
  validation: ValidationResult;
}

export function Step8Review({ data, isSubmitting, onGoToStep, validation }: Step8ReviewProps) {
  const steps = getStepsForOfferType(data.offerWizardType);
  
  // Calculate completion stats (exclude review step itself)
  const contentSteps = steps.filter(s => s.key !== "review");
  const completedSteps = contentSteps.filter(s => isStepComplete(s.key, data)).length;
  const completionPercentage = contentSteps.length > 0 
    ? Math.round((completedSteps / contentSteps.length) * 100)
    : 0;
  
  // Get all missing fields
  const allMissingFields: string[] = [];
  contentSteps.forEach(step => {
    const missing = getMissingFieldsForStep(step.key, data);
    allMissingFields.push(...missing);
  });
  
  const hasErrors = allMissingFields.length > 0;
  const validationErrors = Array.from(new Set(validation.errors));

  const handleGoToStep = (stepKey: OfferWizardStepKey) => {
    const stepNum = getStepNumber(data.offerWizardType, stepKey);
    if (stepNum !== null) {
      onGoToStep(stepNum);
    }
  };

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
                  {completionPercentage === 100 
                    ? "Все данные заполнены ✓" 
                    : `Заполнено ${completedSteps} из ${contentSteps.length} шагов`}
                </span>
                <span className="text-lg font-semibold">{completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    completionPercentage === 100 ? "bg-green-600" : "bg-yellow-600"
                  }`}
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Missing Fields Alert */}
      {hasErrors && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900 mb-2">Требуется заполнить:</h4>
                <ul className="space-y-1">
                  {allMissingFields.map((field, idx) => (
                    <li key={idx} className="text-sm text-red-700">
                      • {field}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasErrors && validationErrors.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-900 mb-2">Проверьте значения полей:</h4>
                <ul className="space-y-1">
                  {validationErrors.map((field, idx) => (
                    <li key={idx} className="text-sm text-amber-800">
                      • {field}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps Review */}
      <div className="space-y-3">
        <h3 className="font-medium">Проверка по шагам</h3>
        {contentSteps.map((step, idx) => {
          const stepNum = idx + 1;
          const isComplete = isStepComplete(step.key, data);
          const missingFields = getMissingFieldsForStep(step.key, data);
          
          return (
            <Card key={step.key} className={isComplete ? "border-green-200" : "border-gray-200"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                      isComplete 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {isComplete ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {missingFields.length > 0 && (
                        <div className="mt-2 text-sm text-red-600">
                          {missingFields.map((field, i) => (
                            <div key={i}>• {field}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGoToStep(step.key)}
                    className="flex-shrink-0"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Изменить
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Контакты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.contactSource === "place" && data.placeId ? (
            <div>
              <div className="font-medium text-foreground">
                Контакты взяты из места: {data.placeTitle || "Выбранная площадка"}
              </div>
              <div className="text-muted-foreground">
                Телефон, сайт и социальные сети будут использованы из выбранной площадки.
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div>
                <span className="font-medium">Телефон:</span>{" "}
                <span className="text-muted-foreground">{data.phone || "Не указан"}</span>
              </div>
              <div>
                <span className="font-medium">Сайт:</span>{" "}
                <span className="text-muted-foreground">{data.website || "Не указан"}</span>
              </div>
              <div>
                <span className="font-medium">Соцсети:</span>{" "}
                <span className="text-muted-foreground">
                  {data.socialLinks.filter((link) => link.url.trim()).length > 0
                    ? data.socialLinks
                        .filter((link) => link.url.trim())
                        .map((link) => link.url.trim())
                        .join(", ")
                    : "Не указаны"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ready to Submit */}
      {completionPercentage === 100 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <h4 className="font-medium text-green-900">Готово к отправке</h4>
                <p className="text-sm text-green-700">
                  Все обязательные поля заполнены. Вы можете отправить предложение на модерацию.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
