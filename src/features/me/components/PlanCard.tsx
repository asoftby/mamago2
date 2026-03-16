"use client";

import Link from "next/link";
import { useState } from "react";
import { Surface } from "@/components/ui/surface";
import { H2, Body, BodyMuted, Caption } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { cn } from "@/lib/utils";
import type { PlanItemWithActivity } from "@/server/services/plan.service";

type PlanCardProps = {
  weekDates: string[];
  planItemsByDate: Record<string, PlanItemWithActivity[]>;
  selectedDate?: string;
};

type DayPillProps = {
  dateStr: string;
  isSelected: boolean;
  isToday: boolean;
  hasItems: boolean;
  itemCount: number;
  onClick: () => void;
};

type PlanItemMiniCardProps = {
  item: PlanItemWithActivity;
};

function DayPill({ dateStr, isSelected, isToday, hasItems, itemCount, onClick }: DayPillProps) {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString("ru-RU", { weekday: "short" }).toUpperCase();
  const dayNum = date.getDate();

  return (
    <button
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 hover:bg-muted text-foreground"
      )}
    >
      {isToday && !isSelected && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
      <Caption
        className={cn(
          "text-xs font-medium mb-0.5",
          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        {dayName}
      </Caption>
      <Body className={cn("font-semibold", isSelected && "text-primary-foreground")}>
        {dayNum}
      </Body>
      {hasItems && (
        <div
          className={cn(
            "absolute bottom-1.5 w-1 h-1 rounded-full",
            isSelected ? "bg-primary-foreground" : "bg-primary"
          )}
        />
      )}
    </button>
  );
}

function WeekStrip({
  weekDates,
  selectedDate,
  todayStr,
  planItemsByDate,
  onDateSelect,
}: {
  weekDates: string[];
  selectedDate: string;
  todayStr: string;
  planItemsByDate: Record<string, PlanItemWithActivity[]>;
  onDateSelect: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDates.map((dateStr) => {
        const itemCount = planItemsByDate[dateStr]?.length || 0;
        const hasItems = itemCount > 0;
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === todayStr;

        return (
          <DayPill
            key={dateStr}
            dateStr={dateStr}
            isSelected={isSelected}
            isToday={isToday}
            hasItems={hasItems}
            itemCount={itemCount}
            onClick={() => onDateSelect(dateStr)}
          />
        );
      })}
    </div>
  );
}

function PlanItemMiniCard({ item }: PlanItemMiniCardProps) {
  const activity = item.activity;

  const formatTime = (dateTime: Date) => {
    return dateTime.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Surface
      variant="soft"
      className="p-4 flex gap-3 hover:bg-muted/80 transition-colors"
    >
      <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
        {activity?.coverImageUrl ? (
          <img
            src={activity.coverImageUrl}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <span className="text-primary text-xl">📅</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {activity ? (
          <>
            <Body className="font-medium line-clamp-2 mb-1">{activity.title}</Body>
            <Caption className="text-muted-foreground">
              {item.startsAt ? formatTime(item.startsAt) : "В любое время"}
            </Caption>
          </>
        ) : (
          <BodyMuted className="text-sm">Activity ID: {item.activityId}</BodyMuted>
        )}
      </div>
    </Surface>
  );
}

function DaySection({
  dateStr,
  items,
}: {
  dateStr: string;
  items: PlanItemWithActivity[];
}) {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString("ru-RU", { weekday: "long" });
  const day = date.getDate();
  
  // Russian months in genitive case (used with day numbers)
  const monthsGenitive = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const month = monthsGenitive[date.getMonth()];
  
  // Capitalize first letter of weekday
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Body className="font-semibold">
          {capitalizedWeekday}, {day} {month}
        </Body>
        {items.length > 0 && (
          <Link href={`/me/day/${dateStr}`}>
            <Button variant="ghost" size="sm" className="text-primary">
              Сценарий →
            </Button>
          </Link>
        )}
      </div>
      {items.length > 0 ? (
        <>
          <div className="space-y-2">
            {items.map((item) => (
              <PlanItemMiniCard key={item.id} item={item} />
            ))}
          </div>
          {items.length < 2 && (
            <BodyMuted className="text-sm text-center pt-2">
              Добавьте ещё событие — и мы соберём сценарий дня.
            </BodyMuted>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <BodyMuted className="mb-4">Пока ничего не запланировано.</BodyMuted>
          <Link href="/minsk">
            <PrimaryButton size="sm">Найти событие</PrimaryButton>
          </Link>
        </div>
      )}
    </div>
  );
}

export function PlanCard({ weekDates, planItemsByDate, selectedDate: initialSelectedDate }: PlanCardProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialSelectedDate) return initialSelectedDate;
    return weekDates.find((d) => planItemsByDate[d]?.length > 0) || todayStr;
  });
  const currentItems = planItemsByDate[selectedDate] || [];

  return (
    <Surface variant="elevated" className="p-6">
      <div className="flex items-center justify-between mb-6">
        <H2>Ближайшие планы</H2>
      </div>
      <div className="mb-6">
        <WeekStrip
          weekDates={weekDates}
          selectedDate={selectedDate}
          todayStr={todayStr}
          planItemsByDate={planItemsByDate}
          onDateSelect={setSelectedDate}
        />
      </div>
      <DaySection dateStr={selectedDate} items={currentItems} />
    </Surface>
  );
}
