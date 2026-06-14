// Step 1: Offer Type
// Refactored for SINGLE, REGULAR, CAMP types

import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Repeat2, Tent } from "lucide-react";
import type { OfferFormData, OfferWizardType } from "../types";

interface Step1TypeProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step1Type({ data, onChange, isEditable }: Step1TypeProps) {
  const handleTypeChange = (offerWizardType: OfferWizardType) => {
    const legacy =
      offerWizardType === "CAMP"
        ? { offerKind: "course" as const, durationType: "camp" as const, intent: "занятия" as const }
        : offerWizardType === "SINGLE"
          ? { offerKind: "course" as const, durationType: "single" as const, intent: "куда_пойти" as const }
          : { offerKind: "course" as const, durationType: "recurring" as const, intent: "занятия" as const };

    onChange({
      offerWizardType,
      ...legacy,
      serviceType: null,
      locationType: null,
    });
  };

  const offerTypeOptions = [
    {
      value: "SINGLE" as const,
      label: "Разовое занятие",
      description: "Одно занятие, мастер-класс или разовое мероприятие",
      icon: GraduationCap,
    },
    {
      value: "REGULAR" as const,
      label: "Регулярные занятия",
      description: "Курс, секция, абонемент или серия занятий",
      icon: Repeat2,
    },
    {
      value: "CAMP" as const,
      label: "Лагерь / смена",
      description: "Программа на несколько дней: каникулы, дневной лагерь или тематическая смена",
      icon: Tent,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Тип предложения</h2>
        <p className="text-muted-foreground">
          Выберите формат предложения — это определит дальнейшие шаги
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {offerTypeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = data.offerWizardType === option.value;
          
          return (
            <Card
              key={option.value}
              className={`cursor-pointer transition-all duration-200 ${
                isSelected
                  ? "ring-2 ring-[#EF8759] border-[#EF8759] bg-orange-50"
                  : "hover:border-gray-300"
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => isEditable && handleTypeChange(option.value)}
            >
              <CardContent className="p-6 text-center">
                <Icon className="w-8 h-8 mx-auto mb-3 text-[#EF8759]" />
                <h5 className="font-semibold mb-2 text-gray-900">{option.label}</h5>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
