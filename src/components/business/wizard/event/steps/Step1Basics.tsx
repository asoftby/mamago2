"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { EventFormData } from "../types";

interface Step1BasicsProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

const ACTIVITY_TYPES = [
  { value: "active", label: "Активно" },
  { value: "educational", label: "Познавательно" },
  { value: "calm", label: "Спокойно" },
] as const;

const CATEGORIES = [
  "Выставка",
  "Мастер-класс",
  "Кино",
  "Игры",
  "Квесты",
  "Квизы",
  "Экскурсии",
];

const AGE_OPTIONS = [
  "0-3",
  "3-7",
  "7-12",
  "12-18",
  "18+",
];

export function Step1Basics({ data, onChange, isEditable }: Step1BasicsProps) {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ title: e.target.value });
  };

  const handleActivityTypeChange = (value: "active" | "educational" | "calm") => {
    onChange({ activityType: value });
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = data.categories.includes(category)
      ? data.categories.filter(c => c !== category)
      : [...data.categories, category];
    onChange({ categories: newCategories });
  };

  const handleAgeToggle = (age: string) => {
    const newAge = data.ageGroups.includes(age)
      ? data.ageGroups.filter(a => a !== age)
      : [...data.ageGroups, age];
    onChange({ ageGroups: newAge });
  };

  const showCinemaFields = data.categories.includes("Кино");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Основное</h2>
        <p className="text-sm text-muted-foreground">
          Название, тип активности, категории и возраст
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Название <span className="text-red-500">*</span>
        </Label>
        <Input
          id="title"
          value={data.title}
          onChange={handleTitleChange}
          placeholder="Введите название события"
          disabled={!isEditable}
        />
      </div>

      {/* Activity Type */}
      <div className="space-y-2">
        <Label>
          Тип активности <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-3">
          {ACTIVITY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => handleActivityTypeChange(type.value)}
              disabled={!isEditable}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                data.activityType === type.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-gray-300 hover:border-gray-400"
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <Label>
          Категории <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((category) => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category}`}
                checked={data.categories.includes(category)}
                onCheckedChange={() => handleCategoryToggle(category)}
                disabled={!isEditable}
              />
              <label
                htmlFor={`category-${category}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {category}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Cinema-specific fields */}
      {showCinemaFields && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium">Дополнительно для кино</h3>
          
          <div className="space-y-2">
            <Label htmlFor="cinemaGenre">Жанр</Label>
            <Input
              id="cinemaGenre"
              value={data.cinemaGenre || ""}
              onChange={(e) => onChange({ cinemaGenre: e.target.value })}
              placeholder="Например: комедия, драма"
              disabled={!isEditable}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cinemaDuration">Продолжительность (минуты)</Label>
            <Input
              id="cinemaDuration"
              type="number"
              value={data.cinemaDuration || ""}
              onChange={(e) => onChange({ cinemaDuration: parseInt(e.target.value) || undefined })}
              placeholder="90"
              disabled={!isEditable}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cinemaTrailerLink">Ссылка на трейлер</Label>
            <Input
              id="cinemaTrailerLink"
              value={data.cinemaTrailerUrl || ""}
              onChange={(e) => onChange({ cinemaTrailerUrl: e.target.value })}
              placeholder="https://youtube.com/..."
              disabled={!isEditable}
            />
          </div>
        </div>
      )}

      {/* Age */}
      <div className="space-y-2">
        <Label>
          Возраст <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-3">
          {AGE_OPTIONS.map((age) => (
            <div key={age} className="flex items-center space-x-2">
              <Checkbox
                id={`age-${age}`}
                checked={data.ageGroups.includes(age)}
                onCheckedChange={() => handleAgeToggle(age)}
                disabled={!isEditable}
              />
              <label
                htmlFor={`age-${age}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {age}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
