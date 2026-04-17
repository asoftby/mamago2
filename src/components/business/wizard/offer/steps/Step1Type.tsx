// Step 1: Offer Type
// Inherits Event Wizard Step1Basics pattern

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, PartyPopper, Wrench } from "lucide-react";
import { StableCardSelector, StableCardSelectorSmall } from "@/components/ui/stable-card-selector";
import type { OfferFormData } from "../types";
import { determineIntent } from "../defaults";

interface Step1TypeProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

// CourseFormatSelector Component
interface CourseFormatSelectorProps {
  durationType: "single" | "recurring" | null;
  onDurationTypeChange: (durationType: "single" | "recurring") => void;
  isEditable: boolean;
}

function CourseFormatSelector({
  durationType,
  onDurationTypeChange,
  isEditable
}: CourseFormatSelectorProps) {
  const formatOptions = [
    {
      value: "single" as const,
      label: "Разовое занятие",
      description: "Одно занятие или мастер-класс",
    },
    {
      value: "recurring" as const,
      label: "Курс / регулярные занятия", 
      description: "Серия занятий или абонемент",
    },
  ];

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Формат занятий</h4>
      <div className="grid grid-cols-2 gap-4">
        {formatOptions.map((format) => (
          <Card
            key={format.value}
            className={`cursor-pointer transition-all duration-200 ${
              durationType === format.value
                ? "ring-2 ring-[#EF8759] border-[#EF8759] bg-orange-50"
                : "hover:border-gray-300"
            }`}
            onClick={() => onDurationTypeChange(format.value)}
          >
            <CardContent className="p-4 text-center">
              <h5 className="font-medium mb-2">{format.label}</h5>
              <p className="text-sm text-muted-foreground">
                {format.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ServiceChildSettings Component
interface ServiceChildSettingsProps {
  serviceType: string | null;
  locationType: string | null;
  onServiceTypeChange: (serviceType: "торт" | "декор" | "фотограф" | "аниматор" | "шоу" | "аквагрим" | "ведущий" | "мастер_класс_на_выезд" | "другое") => void;
  onLocationTypeChange: (locationType: "client_location" | "place" | "remote") => void;
  isEditable: boolean;
}

function ServiceChildSettings({
  serviceType,
  locationType,
  onServiceTypeChange,
  onLocationTypeChange,
  isEditable
}: ServiceChildSettingsProps) {
  const serviceOptions: { value: "торт" | "декор" | "фотограф" | "аниматор" | "шоу" | "аквагрим" | "ведущий" | "мастер_класс_на_выезд" | "другое"; label: string }[] = [
    { value: "торт", label: "Торт" },
    { value: "декор", label: "Декор" },
    { value: "фотограф", label: "Фотограф" },
    { value: "аниматор", label: "Аниматор" },
    { value: "шоу", label: "Шоу" },
    { value: "аквагрим", label: "Аквагрим" },
    { value: "ведущий", label: "Ведущий" },
    { value: "мастер_класс_на_выезд", label: "Мастер-класс на выезд" },
    { value: "другое", label: "Другое" },
  ];

  const locationOptions = [
    {
      value: "client_location" as const,
      label: "У клиента",
      description: "Выезд к клиенту",
    },
    {
      value: "place" as const,
      label: "В определённом месте",
      description: "В своей локации или на площадке",
    },
    {
      value: "remote" as const,
      label: "Онлайн / удаленно",
      description: "Дистанционно",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Service Type Selection */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Какая услуга?</h4>
        <div className="grid grid-cols-3 gap-3">
          {serviceOptions.map((service) => (
            <Card
              key={service.value}
              className={`cursor-pointer transition-all duration-200 ${
                serviceType === service.value
                  ? "ring-2 ring-[#EF8759] border-[#EF8759] bg-orange-50"
                  : "hover:border-gray-300"
              }`}
              onClick={() => onServiceTypeChange(service.value)}
            >
              <CardContent className="p-3 text-center">
                <span className="text-sm font-medium">{service.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Location Type Selection */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Где оказывается услуга?</h4>
        <div className="grid grid-cols-3 gap-4">
          {locationOptions.map((location) => (
            <Card
              key={location.value}
              className={`cursor-pointer transition-all duration-200 ${
                locationType === location.value
                  ? "ring-2 ring-[#EF8759] border-[#EF8759] bg-orange-50"
                  : "hover:border-gray-300"
              }`}
              onClick={() => onLocationTypeChange(location.value)}
            >
              <CardContent className="p-4 text-center">
                <h5 className="font-medium mb-2">{location.label}</h5>
                <p className="text-sm text-muted-foreground">
                  {location.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Step1Type({ data, onChange, isEditable }: Step1TypeProps) {
  const [helperText, setHelperText] = useState("");

  const handleOfferKindChange = (offerKind: "course" | "birthday" | "service") => {
    onChange({
      offerKind,
      durationType: null, // Reset duration type when changing offer kind
      serviceType: null, // Reset service type when changing offer kind
      locationType: null, // Reset location type when changing offer kind
    });
  };

  const handleServiceTypeChange = (serviceType: "торт" | "декор" | "фотограф" | "аниматор" | "шоу" | "аквагрим" | "ведущий" | "мастер_класс_на_выезд" | "другое") => {
    onChange({ serviceType });
  };

  const handleLocationTypeChange = (locationType: "client_location" | "place" | "remote") => {
    onChange({ locationType });
  };

  const handleDurationTypeChange = (durationType: "single" | "recurring") => {
    onChange({ durationType });
  };

  const offerTypeOptions = [
    {
      value: "course" as const,
      label: "Курс / занятия",
      description: "Регулярные занятия и секции для детей",
      icon: GraduationCap,
    },
    {
      value: "birthday" as const,
      label: "Детский праздник",
      description: "Готовая программа дня рождения или праздник под ключ",
      icon: PartyPopper,
    },
    {
      value: "service" as const,
      label: "Услуга",
      description: "Отдельная услуга: торт, декор, фотограф, аниматор и другие услуги",
      icon: Wrench,
    },
  ];

  const renderNestedContent = (offerKind: "course" | "birthday" | "service") => {
    if (offerKind === "course") {
      return (
        <CourseFormatSelector
          durationType={data.durationType}
          onDurationTypeChange={handleDurationTypeChange}
          isEditable={isEditable}
        />
      );
    }
    
    if (offerKind === "service") {
      return (
        <ServiceChildSettings
          serviceType={data.serviceType}
          locationType={data.locationType}
          onServiceTypeChange={handleServiceTypeChange}
          onLocationTypeChange={handleLocationTypeChange}
          isEditable={isEditable}
        />
      );
    }
    
    // Birthday - no child settings yet
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Тип предложения</h2>
        <p className="text-muted-foreground">
          Что именно предлагается пользователям?
        </p>
      </div>

      <div className="space-y-4">
        {/* Offer Type Cards with Stable Selection */}
        <StableCardSelector
          value={data.offerKind}
          onValueChange={handleOfferKindChange}
          options={offerTypeOptions}
          isEditable={isEditable}
        >
          {renderNestedContent}
        </StableCardSelector>

        {/* Helper Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Не уверены что выбрать?</h4>
          <p className="text-sm text-gray-600 mb-3">Напишите что вы предлагаете</p>
          <Input
            placeholder="Например: курс, день рождения, торт, аниматор"
            value={helperText}
            onChange={(e) => setHelperText(e.target.value)}
            disabled={!isEditable}
            className="bg-white"
          />
        </div>

        {/* Auto-determined Intent Preview */}
        {data.offerKind && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Раздел каталога</h4>
            <p className="text-sm text-blue-700">
              Предложение автоматически попадет в раздел:{" "}
              <span className="font-medium">
                {determineIntent(data) || "Определяется автоматически"}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}