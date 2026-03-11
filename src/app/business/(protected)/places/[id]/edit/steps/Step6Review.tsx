"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { validateStep1, validateStep2, validateStep3 } from "../utils/stepValidation";
import { WizardStepHeader } from "../components/WizardStepHeader";
import type { PlaceWithImages } from "../types";
import type { OpeningHoursData } from "@/components/openingHours";

interface Step6ReviewProps {
  place: PlaceWithImages;
  openingHoursData: OpeningHoursData | null;
  onSubmit: () => void;
  isSubmitting: boolean;
  onPrev: () => void;
  showSubmitButton?: boolean; // Hide submit button when using sticky bar
}

export function Step6Review({ 
  place, 
  openingHoursData, 
  onSubmit, 
  isSubmitting,
  onPrev,
  showSubmitButton = true
}: Step6ReviewProps) {
  const step1Valid = validateStep1(place);
  const step2Valid = validateStep2(place);
  const step3Valid = validateStep3(place);
  const hasContacts = !!(place.phone || place.website || place.instagramHandle);
  
  // Check if contacts are fully filled (all 3 fields)
  const contactsFullyFilled = !!(place.phone && place.website && place.instagramHandle);
  
  // Check if there's meaningful opening hours data
  const hasOpeningHours = !!openingHoursData && (
    openingHoursData.mode === "ALWAYS_OPEN" ||
    openingHoursData.mode === "BY_APPOINTMENT" ||
    openingHoursData.mode === "TEMPORARILY_CLOSED" ||
    (openingHoursData.mode === "WEEKLY" && openingHoursData.rules.some(rule => 
      rule.isOpen && rule.intervals && rule.intervals.length > 0
    ))
  );
  const allRequiredCompleted = step1Valid && step2Valid && step3Valid;

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Проверка и отправка"
        subtitle="Проверьте информацию перед отправкой на модерацию"
        onBack={onPrev}
        canBack={true}
        backLabel="Назад"
        currentStep={6}
        totalSteps={6}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Требования для публикации
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Профиль места заполнен</span>
            {step1Valid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Заполнено
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Требуется
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Местоположение указано</span>
            {step2Valid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Заполнено
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Требуется
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm">Фотографии загружены</span>
            {step3Valid ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Заполнено
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="w-3 h-3 mr-1" />
                Требуется
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Контактная информация</span>
            {contactsFullyFilled ? (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Заполнено
              </Badge>
            ) : hasContacts ? (
              <Badge variant="default" className="bg-blue-100 text-blue-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Частично заполнено
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                Опционально
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">Режим работы</span>
            {hasOpeningHours ? (
              <Badge variant="default" className="bg-blue-100 text-blue-800">
                <CheckCircle className="w-3 h-3 mr-1" />
                Частично заполнено
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Clock className="w-3 h-3 mr-1" />
                Опционально
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!allRequiredCompleted && showSubmitButton && (
        <p className="text-center text-sm text-red-600">
          Заполните все обязательные поля перед отправкой
        </p>
      )}

      {/* Primary CTA at bottom - only show if not using sticky bar */}
      {showSubmitButton && (
        <div className="flex justify-center pt-6">
          <Button
            onClick={onSubmit}
            disabled={!allRequiredCompleted || isSubmitting}
            size="lg"
            className="min-w-[200px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Отправляем...
              </>
            ) : (
              "Отправить на модерацию"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}