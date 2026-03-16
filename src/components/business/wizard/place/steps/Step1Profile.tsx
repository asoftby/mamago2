"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_OPTIONS } from "@/lib/config/ages";
import { PLACE_CATEGORIES, VISIT_FORMATS, ACTIVITY_TYPES } from "../config";
import type { PlaceFormData } from "../types";

interface Step1ProfileProps {
  data: PlaceFormData;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step1Profile({ data, onChange, isEditable = true }: Step1ProfileProps) {
  const [title, setTitle] = useState(data.title);
  const [category, setCategory] = useState(data.category);
  const [shortDesc, setShortDesc] = useState(data.shortDesc);
  const [description, setDescription] = useState(data.description || "");
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [ageTags, setAgeTags] = useState<string[]>(data.ageTags || []);
  const [visitFormats, setVisitFormats] = useState<string[]>(data.visitFormats || []);
  const [activityTypes, setActivityTypes] = useState<string[]>(data.activityTypes || []);

  useEffect(() => {
    setTitle(data.title);
    setCategory(data.category);
    setShortDesc(data.shortDesc);
    setDescription(data.description || "");
    setAgeTags(data.ageTags || []);
    setVisitFormats(data.visitFormats || []);
    setActivityTypes(data.activityTypes || []);
  }, [data]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onChange({ title: value });
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    onChange({ category: value });
  };

  const handleShortDescChange = (value: string) => {
    setShortDesc(value);
    onChange({ shortDesc: value });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onChange({ description: value });
  };

  const toggleAgeTag = (tag: string) => {
    const newTags = ageTags.includes(tag)
      ? ageTags.filter((t) => t !== tag)
      : [...ageTags, tag];
    setAgeTags(newTags);
    onChange({ ageTags: newTags });
  };

  const toggleVisitFormat = (format: string) => {
    const newFormats = visitFormats.includes(format)
      ? visitFormats.filter((f) => f !== format)
      : [...visitFormats, format];
    setVisitFormats(newFormats);
    onChange({ visitFormats: newFormats });
  };

  const toggleActivityType = (type: string) => {
    const newTypes = activityTypes.includes(type)
      ? activityTypes.filter((t) => t !== type)
      : [...activityTypes, type];
    setActivityTypes(newTypes);
    onChange({ activityTypes: newTypes });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="title">Название *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Например: Кофейня на Ленина"
          className="mt-2"
          disabled={!isEditable}
        />
      </div>

      <div>
        <Label htmlFor="category">Категория *</Label>
        <div className="relative mt-2">
          <select
            id="category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="h-[2.75rem] w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
            disabled={!isEditable}
          >
            <option value="">Выберите категорию</option>
            {PLACE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div>
        <Label htmlFor="shortDesc">Короткое описание *</Label>
        <Input
          id="shortDesc"
          value={shortDesc}
          onChange={(e) => handleShortDescChange(e.target.value)}
          placeholder="Краткое описание для карточки"
          className="mt-2"
          maxLength={100}
          disabled={!isEditable}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {shortDesc.length}/100 символов
        </p>
      </div>

      <div>
        <Label htmlFor="description">Описание *</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Подробное описание места"
          className="mt-2"
          rows={showFullDescription ? 10 : 4}
          maxLength={5000}
          disabled={!isEditable}
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">
            {description.length}/5000 символов
          </p>
          {!showFullDescription && description.length > 200 && (
            <button
              type="button"
              onClick={() => setShowFullDescription(true)}
              className="text-xs text-primary hover:underline"
            >
              Показать полностью
            </button>
          )}
        </div>
      </div>

      <div>
        <Label>Возраст *</Label>
        <div className="mt-2">
          <ChipsRow
            items={AGE_OPTIONS.map((ageOption): ChipItem => ({
              id: ageOption.key,
              label: ageOption.shortLabel,
              active: ageTags.includes(ageOption.key),
              disabled: !isEditable,
              onClick: () => isEditable && toggleAgeTag(ageOption.key),
            }))}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один возрастной диапазон
        </p>
      </div>

      <div>
        <Label>Формат посещения *</Label>
        <div className="mt-2">
          <ChipsRow
            items={VISIT_FORMATS.map((format): ChipItem => ({
              id: format,
              label: format,
              active: visitFormats.includes(format),
              disabled: !isEditable,
              onClick: () => isEditable && toggleVisitFormat(format),
            }))}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один формат посещения
        </p>
      </div>

      <div>
        <Label>Типы активностей *</Label>
        <div className="mt-2">
          <ChipsRow
            items={ACTIVITY_TYPES.map((type): ChipItem => ({
              id: type,
              label: type,
              active: activityTypes.includes(type),
              disabled: !isEditable,
              onClick: () => isEditable && toggleActivityType(type),
            }))}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один тип активности
        </p>
      </div>
    </div>
  );
}
