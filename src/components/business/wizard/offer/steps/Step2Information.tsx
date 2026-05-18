// Step 2: Public Information
// Inherits Event Wizard Step2Description pattern

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { RichDescriptionEditor } from "@/components/editor/RichDescriptionEditor";
import type { OfferFormData } from "../types";
import { StructuredDiscoverySignalPicker } from "../../shared/StructuredDiscoverySignalPicker";
import { OfferClassChipPicker } from "../components/OfferClassChipPicker";
import { SignalEntityType } from "@prisma/client";

interface Step2InformationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step2Information({ data, onChange, isEditable }: Step2InformationProps) {
  const isCampOffer = data.offerWizardType === "CAMP";

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

      {/* Discovery Signals - Structured */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Характеристики предложения</h3>
          <p className="text-sm text-muted-foreground">
            Помогают пользователям найти это предложение в каталоге
          </p>
        </div>

        <StructuredDiscoverySignalPicker
          entityType={SignalEntityType.OFFER}
          value={data.signalIds ?? []}
          onChange={(ids) => onChange({ signalIds: ids })}
          disabled={!isEditable}
          groupConfigs={[
            {
              slug: "discovery-activity",
              title: "Чем будут заниматься",
              required: true,
              min: 1,
              max: 4,
              helperText: "Основные виды активности",
              preferredOptionValues: isCampOffer
                ? ["discovery-activity-educational"]
                : undefined,
            },
            {
              slug: "discovery-format",
              title: "Где проходит",
              required: true,
              min: 1,
              helperText: "Формат проведения",
              preferredOptionValues: isCampOffer
                ? ["discovery-format-indoor", "discovery-format-outdoor"]
                : undefined,
            },
            {
              slug: "discovery-participation",
              title: "Как проходит",
              required: true,
              min: 1,
              helperText: "Формат участия",
              preferredOptionValues: isCampOffer
                ? [
                    "discovery-participation-group",
                    "discovery-participation-without-parents",
                  ]
                : undefined,
            },
            {
              slug: "discovery-intention",
              title: "Для чего это подходит",
              required: false,
              max: isCampOffer ? 5 : 3,
              helperText: "Сценарии использования (опционально)",
              preferredOptionValues: isCampOffer
                ? [
                    "discovery-intention-useful-vacation",
                    "discovery-intention-vacation-childcare",
                    "discovery-intention-improve-english",
                    "discovery-intention-communication-skills",
                  ]
                : undefined,
            },
            {
              slug: "discovery-feature",
              title: "Особенности",
              required: false,
              max: 5,
              helperText: "Дополнительные преимущества (опционально)",
              preferredOptionValues: isCampOffer
                ? [
                    "discovery-feature-vacation",
                    "discovery-feature-full-day",
                    "discovery-feature-half-day",
                    "discovery-feature-meals",
                    "discovery-feature-limited",
                  ]
                : undefined,
            },
          ]}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold mb-1">Чипы витрины “Занятия”</h3>
          <p className="text-sm text-muted-foreground">
            Помогают показать предложение в конкретных категориях на странице занятий. Без выбора предложение останется только в чипе “Все”.
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
