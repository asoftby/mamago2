import React from "react";
import { ActivityCard } from "./ActivityCard";
import { ActivityMock } from "@/types/activity";
import { cn } from "@/lib/utils";
import { formatRuShortDayMonth } from "@/lib/formatters/date";

interface ActivityGridProps {
  activities: ActivityMock[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onOpen?: (id: string) => void;
  className?: string;
}

export function ActivityGrid({
  activities,
  favorites,
  onToggleFavorite,
  onOpen,
  className
}: ActivityGridProps) {
  if (activities.length === 0) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Нет активностей по выбранным фильтрам
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-8", className)}>
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          saveMeta={{
            title: activity.title,
            dateISO: activity.dateStart ?? null,
            dateLabel: activity.dateStart ? formatRuShortDayMonth(activity.dateStart) : null,
          }}
        />
      ))}
    </div>
  );
}
