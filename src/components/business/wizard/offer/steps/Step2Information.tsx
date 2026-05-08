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
import { SignalEntityType } from "@prisma/client";

interface Step2InformationProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

export function Step2Information({ data, onChange, isEditable }: Step2InformationProps) {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ title: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ shortDescription: e.target.value });
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
          Название предложения <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Например: Пробное занятие по рисованию"
          value={data.title}
          onChange={handleTitleChange}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground">
          Краткое и понятное название того, что предлагается
        </p>
      </div>

      {/* Short Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Краткое описание <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Опишите кратко суть предложения, что получит клиент..."
          value={data.shortDescription}
          onChange={handleDescriptionChange}
          disabled={!isEditable}
          rows={3}
          className={!isDescriptionValid ? "border-red-500" : ""}
        />
        <div className="flex justify-between text-xs">
          <p className="text-muted-foreground">
            Краткое описание для превью в каталоге
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
          ]}
        />
      </div>
    </div>
  );
}