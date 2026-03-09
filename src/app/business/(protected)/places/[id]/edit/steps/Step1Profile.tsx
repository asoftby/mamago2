"use client";

import { useState, useEffect } from "react";
import type { Place } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardStepHeader } from "../components/WizardStepHeader";
import { AGE_OPTIONS } from "@/lib/config/ages";

interface Step1ProfileProps {
  place: Place;
  onUpdate: (updates: Partial<Place>) => void;
  onNext: () => void;
  canNext: boolean;
  isEditable?: boolean;
}

const CATEGORIES = [
  { value: "cafe", label: "Кафе и рестораны" },
  { value: "museum", label: "Музеи" },
  { value: "park", label: "Парки и площадки" },
  { value: "kids-center", label: "Детские центры" },
  { value: "theater", label: "Театры" },
  { value: "sport", label: "Спортивные объекты" },
  { value: "entertainment", label: "Развлечения" },
  { value: "education", label: "Образование" },
  { value: "other", label: "Другое" },
];

const VISIT_FORMATS = ["indoor", "outdoor", "online"];
const ACTIVITY_TYPES = ["sports", "arts", "education", "entertainment", "food"];

export function Step1Profile({ place, onUpdate, onNext, canNext, isEditable = true }: Step1ProfileProps) {
  const [title, setTitle] = useState(place.title);
  const [category, setCategory] = useState(place.category);
  const [shortDesc, setShortDesc] = useState(place.shortDesc);
  const [description, setDescription] = useState(place.description || "");
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [ageTags, setAgeTags] = useState<string[]>(place.ageTags || []);
  const [visitFormats, setVisitFormats] = useState<string[]>(place.visitFormats || []);
  const [activityTypes, setActivityTypes] = useState<string[]>(place.activityTypes || []);

  useEffect(() => {
    setTitle(place.title);
    setCategory(place.category);
    setShortDesc(place.shortDesc);
    setDescription(place.description || "");
    setAgeTags(place.ageTags || []);
    setVisitFormats(place.visitFormats || []);
    setActivityTypes(place.activityTypes || []);
  }, [place.title, place.category, place.shortDesc, place.description, place.ageTags, place.visitFormats, place.activityTypes]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onUpdate({ title: value });
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    onUpdate({ category: value });
  };

  const handleShortDescChange = (value: string) => {
    setShortDesc(value);
    onUpdate({ shortDesc: value });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onUpdate({ description: value });
  };

  const toggleAgeTag = (tag: string) => {
    const newTags = ageTags.includes(tag)
      ? ageTags.filter((t) => t !== tag)
      : [...ageTags, tag];
    setAgeTags(newTags);
    onUpdate({ ageTags: newTags });
  };

  const toggleVisitFormat = (format: string) => {
    const newFormats = visitFormats.includes(format)
      ? visitFormats.filter((f) => f !== format)
      : [...visitFormats, format];
    setVisitFormats(newFormats);
    onUpdate({ visitFormats: newFormats });
  };

  const toggleActivityType = (type: string) => {
    const newTypes = activityTypes.includes(type)
      ? activityTypes.filter((t) => t !== type)
      : [...activityTypes, type];
    setActivityTypes(newTypes);
    onUpdate({ activityTypes: newTypes });
  };

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Профиль места"
        subtitle="Основная информация о вашем месте"
        onNext={onNext}
        canNext={canNext}
      />

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
        <Label htmlFor="category">Категория *</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2"
          disabled={!isEditable}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Типы активностей *</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {ACTIVITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => isEditable && toggleActivityType(type)}
              disabled={!isEditable}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                activityTypes.includes(type)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:border-primary"
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {type}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один тип активности
        </p>
      </div>

      <div>
        <Label>Возраст *</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {AGE_OPTIONS.map((ageOption) => (
            <button
              key={ageOption.key}
              type="button"
              onClick={() => isEditable && toggleAgeTag(ageOption.key)}
              disabled={!isEditable}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                ageTags.includes(ageOption.key)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:border-primary"
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {ageOption.shortLabel}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один возрастной диапазон
        </p>
      </div>

      <div>
        <Label>Формат посещения *</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {VISIT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => isEditable && toggleVisitFormat(format)}
              disabled={!isEditable}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                visitFormats.includes(format)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:border-primary"
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {format}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Выберите хотя бы один формат посещения
        </p>
      </div>
    </div>
  );
}
