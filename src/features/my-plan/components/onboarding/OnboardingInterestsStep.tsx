"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

const INTERESTS = [
  { slug: "sport", label: "Спорт", emoji: "⚽" },
  { slug: "music", label: "Музыка", emoji: "🎵" },
  { slug: "art", label: "Рисование", emoji: "🎨" },
  { slug: "dance", label: "Танцы", emoji: "💃" },
  { slug: "animals", label: "Животные", emoji: "🐱" },
  { slug: "books", label: "Книги", emoji: "📚" },
  { slug: "construction", label: "Конструкторы", emoji: "🧩" },
  { slug: "science", label: "Наука", emoji: "🔬" },
  { slug: "nature", label: "Природа", emoji: "🌿" },
  { slug: "technology", label: "Техника", emoji: "🤖" },
  { slug: "creativity", label: "Творчество", emoji: "✨" },
  { slug: "active-games", label: "Активные игры", emoji: "🏃" },
  { slug: "quiet-activities", label: "Спокойные занятия", emoji: "🧘" },
];

interface OnboardingInterestsStepProps {
  selectedInterests: string[];
  onToggleInterest: (interest: string) => void;
  onComplete: () => Promise<void>;
  isLoading?: boolean;
}

export function OnboardingInterestsStep({
  selectedInterests,
  onToggleInterest,
  onComplete,
  isLoading = false,
}: OnboardingInterestsStepProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Что нравится вашему ребенку?</h2>
          <p className="text-gray-600">Выберите интересы, чтобы мы подобрали идеальные места для вашей семьи</p>
        </div>

        {/* Interests Grid */}
        <div className="grid grid-cols-2 gap-2">
          {INTERESTS.map((interest) => {
            const isSelected = selectedInterests.includes(interest.slug);
            return (
              <button
                key={interest.slug}
                onClick={() => onToggleInterest(interest.slug)}
                className={`p-3 rounded-xl text-sm font-medium transition-all border-2 text-center ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                <div className="text-lg mb-1">{interest.emoji}</div>
                <div>{interest.label}</div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Выберите несколько интересов (рекомендуем 3-5) для более точных рекомендаций
        </p>
      </div>

      {/* CTA Button */}
      <div className="flex-shrink-0 px-6 py-4 border-t bg-white">
        <Button
          onClick={onComplete}
          disabled={selectedInterests.length === 0 || isLoading}
          className="w-full h-12 text-base font-semibold bg-gray-900 hover:bg-gray-800 disabled:opacity-50"
        >
          {isLoading ? "Загружаем ваш план..." : "Показать мой план"}
          {!isLoading && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
