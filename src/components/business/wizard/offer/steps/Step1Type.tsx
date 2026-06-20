// Step 1: Offer Type
// Product type selector backed by persisted productType.

import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarRange,
  GraduationCap,
  MapPin,
  PartyPopper,
  Repeat2,
  Sparkles,
} from "lucide-react";
import type {
  OfferFormData,
  OfferPlacementKey,
  OfferProductType,
  OfferWizardType,
} from "../types";

interface Step1TypeProps {
  data: OfferFormData;
  onChange: (
    updates:
      | Partial<OfferFormData>
      | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
}

export function Step1Type({ data, onChange, isEditable }: Step1TypeProps) {
  const defaultPlacementByProductType: Record<OfferProductType, OfferPlacementKey> = {
    PLACE_VISIT: "WHERE_TO_GO",
    ONE_TIME_ACTIVITY: "WHERE_TO_GO",
    REGULAR_ACTIVITY: "CLASSES",
    CAMP: "CAMPS",
    PARTY_SERVICE: "BIRTHDAY",
    PARTY_PACKAGE: "BIRTHDAY",
  };

  const wizardTypeByProductType: Record<OfferProductType, OfferWizardType> = {
    PLACE_VISIT: "SINGLE",
    ONE_TIME_ACTIVITY: "SINGLE",
    REGULAR_ACTIVITY: "REGULAR",
    CAMP: "CAMP",
    PARTY_SERVICE: "SINGLE",
    PARTY_PACKAGE: "SINGLE",
  };

  const handleTypeChange = (productType: OfferProductType) => {
    const offerWizardType = wizardTypeByProductType[productType];
    const defaultPlacement = defaultPlacementByProductType[productType];

    const legacy =
      productType === "CAMP"
        ? {
            offerKind: "course" as const,
            durationType: "camp" as const,
            intent: "занятия" as const,
          }
        : productType === "REGULAR_ACTIVITY"
          ? {
              offerKind: "course" as const,
              durationType: "recurring" as const,
              intent: "занятия" as const,
            }
          : productType === "ONE_TIME_ACTIVITY"
            ? {
                offerKind: "course" as const,
                durationType: "single" as const,
                intent: "куда_пойти" as const,
              }
            : productType === "PARTY_PACKAGE"
              ? {
                  offerKind: "birthday" as const,
                  durationType: null,
                  intent: "день_рождения" as const,
                }
              : {
                  offerKind: "service" as const,
                  durationType: null,
                  intent:
                    productType === "PARTY_SERVICE"
                      ? ("день_рождения" as const)
                      : ("куда_пойти" as const),
                };

    onChange((prev: OfferFormData) => ({
      productType,
      offerWizardType,
      requestedPlacements: [defaultPlacement],
      ...legacy,
      serviceType: null,
      locationType: null,
      classFormat:
        productType === "ONE_TIME_ACTIVITY" || productType === "REGULAR_ACTIVITY"
          ? prev.classFormat
          : null,
    }));
  };

  const offerTypeOptions = [
    {
      value: "PLACE_VISIT" as const,
      label: "Посещение места",
      description:
        "Игровая, батутный центр, музей, пространство, куда можно прийти с ребёнком.",
      icon: MapPin,
    },
    {
      value: "ONE_TIME_ACTIVITY" as const,
      label: "Занятие / мастер-класс",
      description: "Разовое занятие, мастер-класс, программа на один день.",
      icon: GraduationCap,
    },
    {
      value: "REGULAR_ACTIVITY" as const,
      label: "Регулярная программа",
      description: "Курс, секция, кружок или занятия по расписанию.",
      icon: Repeat2,
    },
    {
      value: "CAMP" as const,
      label: "Лагерь / смена",
      description: "Каникулы, городской лагерь, смены, интенсивы.",
      icon: CalendarRange,
    },
    {
      value: "PARTY_SERVICE" as const,
      label: "Услуга для праздника",
      description: "Аниматор, шоу, торт, декор, фото, еда или другая услуга.",
      icon: Sparkles,
    },
    {
      value: "PARTY_PACKAGE" as const,
      label: "Праздник под ключ",
      description: "Готовый пакет дня рождения или праздника.",
      icon: PartyPopper,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Что вы хотите добавить?</h2>
        <p className="text-muted-foreground">
          Persisted-тип предложения станет основой шагов мастера и сценариев размещения.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {offerTypeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = data.productType === option.value;
          
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
