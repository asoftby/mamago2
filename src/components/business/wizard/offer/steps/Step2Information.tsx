// Step 2: Public Information
// Inherits Event Wizard Step2Description pattern

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { RichDescriptionEditor } from "@/components/editor/RichDescriptionEditor";
import { AiDescriptionAssistant } from "@/components/ai/AiDescriptionAssistant";
import type { OfferFormData } from "../types";
import {
  StructuredDiscoverySignalPicker,
  type GroupConfig,
  type SignalGroup,
} from "../../shared/StructuredDiscoverySignalPicker";
import { OfferClassChipPicker } from "../components/OfferClassChipPicker";
import { SignalEntityType } from "@prisma/client";
import { getProgramTypeLabel } from "@/lib/public/publicVerticalResolver";
import { CAMP_OFFER_DISCOVERY_PICKER_CONFIGS } from "@/lib/offers/campOfferDiscoverySignals";

interface Step2InformationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

const DEFAULT_OFFER_CHARACTERISTIC_GROUPS: GroupConfig[] = [
  {
    slug: "discovery-activity",
    title: "Чем будут заниматься",
    required: true,
    min: 1,
    max: 4,
    helperText: "Основные виды активности",
  },
  {
    slug: "discovery-format",
    title: "Где проходит",
    required: true,
    min: 1,
    helperText: "Формат проведения",
  },
  {
    slug: "discovery-participation",
    title: "Как проходит",
    required: true,
    min: 1,
    helperText: "Формат участия",
  },
  {
    slug: "discovery-intention",
    title: "Для чего это подходит",
    required: false,
    max: 3,
    helperText: "Сценарии использования (опционально)",
  },
  {
    slug: "discovery-feature",
    title: "Особенности",
    required: false,
    max: 5,
    helperText: "Дополнительные преимущества (опционально)",
  },
];

export function Step2Information({ data, onChange, isEditable }: Step2InformationProps) {
  const isCampOffer = data.offerWizardType === "CAMP";
  const [signalGroups, setSignalGroups] = useState<SignalGroup[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/public/signals/discovery?entityType=OFFER&includeDeprecated=true")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload: { groups?: SignalGroup[] }) => {
        if (!cancelled) {
          setSignalGroups(payload.groups ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignalGroups([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const characteristicGroupConfigs = useMemo(
    () =>
      isCampOffer
        ? [...CAMP_OFFER_DISCOVERY_PICKER_CONFIGS]
        : DEFAULT_OFFER_CHARACTERISTIC_GROUPS,
    [isCampOffer],
  );

  const characteristicGroups = useMemo(() => {
    if (!signalGroups) return null;
    const allowedSlugs = new Set(characteristicGroupConfigs.map((group) => group.slug));
    return signalGroups.filter((group) => allowedSlugs.has(group.slug));
  }, [characteristicGroupConfigs, signalGroups]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ shortDescription: e.target.value });
  };

  const handleCampProgramTypeChange = (value: string) => {
    onChange({ campProgramType: value as "городской" | "выездной" | "смешанный" });
  };

  const handleFullDescriptionChange = (html: string) => {
    onChange({ description: html });
  };

  const handleAgeGroupsChange = (ageKey: string) => {
    const currentAgeGroups = data.ageGroups || [];
    const newAgeGroups = currentAgeGroups.includes(ageKey)
      ? currentAgeGroups.filter(age => age !== ageKey)
      : [...currentAgeGroups, ageKey];
    onChange({ ageGroups: newAgeGroups });
  };

  const remainingChars = 120 - data.shortDescription.length;
  const isDescriptionValid = data.shortDescription.length <= 120;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Публичная информация</h2>
        <p className="text-muted-foreground">
          Как предложение будет выглядеть в каталоге для пользователей
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          {isCampOffer ? "Название программы" : "Название предложения"} <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder={isCampOffer ? "Например: Летний IT-лагерь для детей" : "Например: Пробное занятие по рисованию"}
          value={data.title}
          onChange={handleTitleChange}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          {isCampOffer ? "Название программы лагеря" : "Краткое и понятное название того, что предлагается"}
        </p>
      </div>

      {/* Short Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          {isCampOffer ? "Описание программы" : "Краткое описание"} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder={isCampOffer ? "Расскажите, чему дети научатся, как проходит программа и кому она подходит" : "Опишите кратко суть предложения, что получит клиент..."}
          value={data.shortDescription}
          onChange={handleDescriptionChange}
          disabled={!isEditable}
          rows={3}
          className={!isDescriptionValid ? "border-red-500" : ""}
        />
        <div className="flex justify-between text-xs">
          <p className="text-muted-foreground">
            {isCampOffer ? "Краткое описание программы для превью" : "Краткое описание для превью в каталоге"}
          </p>
          <p className={`${remainingChars < 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {remainingChars} символов осталось
          </p>
        </div>
      </div>

      {/* Full Description */}
      <div className="space-y-2">
        <Label>
          Подробное описание <span className="text-red-500">*</span>
        </Label>
        <AiDescriptionAssistant
          entityType="offer"
          title={data.title}
          value={data.description || ""}
          isEditable={isEditable}
          onApply={handleFullDescriptionChange}
          filledActions={["improve", "shorten", "sell"]}
          context={{
            shortDescription: data.shortDescription,
            offerType: data.offerWizardType ? getProgramTypeLabel(data.offerWizardType) : "",
            campProgramType: data.campProgramType,
            ageRange: data.ageGroups,
            place: data.placeTitle,
            price:
              data.offerWizardType === "CAMP"
                ? data.campSessions
                    .map((session) =>
                      session.priceOverride.trim()
                        ? `${session.title || "Смена"}: ${session.priceOverride}`
                        : "",
                    )
                    .filter(Boolean)
                    .join("; ")
                : data.pricingMode === "single"
                ? `${data.singlePrice} ${data.singleCurrency}`.trim()
                : data.pricingOptions.map((option) => `${option.title}: ${option.price}`).join("; "),
            discount:
              data.offerWizardType === "CAMP"
                ? data.campSessions
                    .map((session) => session.promotionDetails)
                    .filter((value) => value.trim().length > 0)
                    .join("\n")
                : data.promotionDetails,
            validityDates: data.campSessions
              .map((session) => [session.dateFrom, session.dateTo].filter(Boolean).join(" — "))
              .filter(Boolean),
            conditions: [
              data.classDuration,
              data.classGroupSize,
              data.partyDuration,
              data.partyChildrenCount,
              data.partyIncluded,
              data.serviceDuration,
              data.serviceDeliveryArea,
              data.ctaInstructions,
            ],
            schedule: [data.campSessionDuration, data.campStayDuration, data.campDaySchedule],
          }}
        />
        <RichDescriptionEditor
          value={data.description || ""}
          onChange={handleFullDescriptionChange}
          placeholder="Расскажите подробнее о предложении — что входит, как проходит, что особенного..."
          disabled={!isEditable}
          minHeight={200}
        />
        <p className="text-xs text-muted-foreground">
          Полное описание для страницы предложения. Используйте форматирование для лучшей читаемости.
        </p>
      </div>

      {/* Camp Program Type (only for CAMP) */}
      {isCampOffer && (
        <div className="space-y-2">
          <Label>
            Тип программы <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "городской", label: "Городской" },
              { value: "выездной", label: "Выездной" },
              { value: "смешанный", label: "Смешанный" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleCampProgramTypeChange(option.value)}
                disabled={!isEditable}
                className={`p-3 rounded-lg border-2 transition-all ${
                  data.campProgramType === option.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                } ${!isEditable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className="font-medium text-sm">{option.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Выберите формат проведения программы
          </p>
        </div>
      )}

      {/* Age Groups */}
      <div className="space-y-2">
        <Label>Возрастные группы</Label>
        <ChipsRow
          layout="masonry"
          items={AGE_OPTIONS.map((ageOption): ChipItem => ({
            id: ageOption.key,
            label: ageOption.shortLabel,
            active: (data.ageGroups || []).includes(ageOption.key),
            disabled: !isEditable,
            onClick: () => isEditable && handleAgeGroupsChange(ageOption.key),
          }))}
        />
        <p className="text-xs text-muted-foreground">
          Для кого подходит это предложение
        </p>
      </div>

      {characteristicGroups && characteristicGroups.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Характеристики предложения</h3>
            <p className="text-sm text-muted-foreground">
              {isCampOffer
                ? "Помогают родителям понять формат, условия и кому подойдёт программа"
                : "Помогают пользователям найти это предложение в каталоге"}
            </p>
          </div>

          <StructuredDiscoverySignalPicker
            entityType={SignalEntityType.OFFER}
            value={data.signalIds ?? []}
            onChange={(ids) => onChange({ signalIds: ids })}
            disabled={!isEditable}
            groupConfigs={characteristicGroupConfigs}
            preloadedGroups={characteristicGroups}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold mb-1">Чипы витрины «Занятия»</h3>
          <p className="text-sm text-muted-foreground">
            Помогают показать предложение в конкретных категориях на странице занятий. Без выбора предложение останется только в чипе «Все».
          </p>
        </div>
        <OfferClassChipPicker
          value={data.classChipSlugs ?? []}
          onChange={(classChipSlugs) => onChange({ classChipSlugs })}
          disabled={!isEditable}
        />
      </div>
    </div>
  );
}
