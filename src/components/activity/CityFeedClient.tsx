"use client";

import { useState } from "react";
import { ActivityGrid } from "@/components/activity/ActivityGrid";
import { Chip } from "@/components/ui/Chip";
import { ActivityMock } from "@/mocks/activity.types";
import { getFavorites, toggleFavorite } from "@/lib/localFavorites";

interface CityFeedClientProps {
  city: string;
  activities: ActivityMock[];
}

const FILTERS = [
  { id: "today", label: "Сегодня" },
  { id: "weekend", label: "Выходные" },
  { id: "free", label: "Бесплатно" },
  { id: "class", label: "Занятия" },
  { id: "birthday", label: "День рождения" },
];

export function CityFeedClient({ city, activities }: CityFeedClientProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [isMounted, setIsMounted] = useState(true);

  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleToggleFavorite = (id: string) => {
    const newFavs = toggleFavorite(id);
    setFavorites(newFavs);
  };

  if (!isMounted) return null;

  const cityName = city === "minsk" ? "Минске" : city;

  const filteredActivities = activities.filter(activity => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some(tag => activity.tags.includes(tag));
  });

  return (
    <div className="pt-8 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-[26px] font-bold leading-tight">
          Куда пойти с ребёнком в {cityName}?
        </h1>
        
        {/* Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {FILTERS.map((filter) => (
            <Chip
              key={filter.id}
              active={selectedTags.includes(filter.id)}
              onClick={() => handleToggleTag(filter.id)}
              className="whitespace-nowrap"
            >
              {filter.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Feed */}
      <ActivityGrid 
        activities={filteredActivities} 
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
