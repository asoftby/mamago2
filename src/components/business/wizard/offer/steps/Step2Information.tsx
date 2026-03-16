// Step 2: Public Information
// Inherits Event Wizard Step2Description pattern

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_OPTIONS } from "@/lib/config/ages";
import type { OfferFormData } from "../types";

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

      {/* Age Groups */}
      <div className="space-y-2">
        <Label>Возрастные группы</Label>
        <ChipsRow
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

      {/* Preview */}
      {data.title && data.shortDescription && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium mb-2">Превью в каталоге</h4>
          <div className="bg-white border rounded-lg p-4">
            <h5 className="font-medium mb-2">{data.title}</h5>
            <p className="text-sm text-muted-foreground mb-3">{data.shortDescription}</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Предложение
              </span>
              {data.ageGroups.length > 0 && (
                <span className="text-muted-foreground">
                  {data.ageGroups.join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}