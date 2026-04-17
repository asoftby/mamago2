"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { publicActivityPath } from "@/lib/business/eventPublicLink";
import { Surface } from "@/components/ui/surface";
import { H2, Body, BodyMuted, Caption } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { PlanItemWithActivity } from "@/server/services/plan.service";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { DayScenarioBlock } from "./DayScenarioBlock";

interface ChildData {
  id: string;
  name: string;
  birthDate: Date;
  systemInterests?: { interestSlug: string }[];
}

type PlanCardProps = {
  weekDates: string[];
  planItemsByDate: Record<string, PlanItemWithActivity[]>;
  selectedDate?: string;
  children?: ChildData[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_GENITIVE = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря",
];

const MONTHS_FULL = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
];

const WEEKDAYS_RU = [
  "воскресенье","понедельник","вторник","среду","четверг","пятницу","субботу",
];

function getDayTitle(dateStr: string, todayStr: string): string {
  const tomorrow = new Date(todayStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Мои планы на сегодня";
  if (dateStr === tomorrowStr) return "Мои планы на завтра";

  const d = new Date(dateStr);
  const weekday = WEEKDAYS_RU[d.getDay()];
  const day = d.getDate();
  const month = MONTHS_GENITIVE[d.getMonth()];
  return `Планы на ${weekday}, ${day} ${month}`;
}

function getWeekDates(baseWeekDates: string[], weekOffset: number): string[] {
  if (weekOffset === 0) return baseWeekDates;
  return baseWeekDates.map((d) => {
    const date = new Date(d);
    date.setDate(date.getDate() + weekOffset * 7);
    return date.toISOString().split("T")[0];
  });
}

// ── DayPill ───────────────────────────────────────────────────────────────────

function DayPill({ dateStr, isSelected, isToday, hasItems, itemCount, onClick }: {
  dateStr: string; isSelected: boolean; isToday: boolean;
  hasItems: boolean; itemCount: number; onClick: () => void;
}) {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString("ru-RU", { weekday: "short" }).toUpperCase();
  const dayNum = date.getDate();
  const dots = hasItems ? Math.min(itemCount, 2) : 0;

  return (
    <button onClick={onClick} aria-pressed={isSelected}
      className={cn(
        "relative flex flex-col items-center justify-center p-3 rounded-xl transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 hover:bg-muted text-foreground",
      )}>
      {isToday && !isSelected && (
        <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
      <Caption className={cn("text-xs font-medium mb-0.5", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {dayName}
      </Caption>
      <Body className={cn("font-semibold", isSelected && "text-primary-foreground")}>{dayNum}</Body>
      <div className="flex gap-[3px] mt-1 h-1.5 items-center justify-center">
        {dots > 0 ? Array.from({ length: dots }).map((_, i) => (
          <div key={i} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")} />
        )) : <div className="w-1 h-1" />}
      </div>
    </button>
  );
}

// ── WeekStrip ─────────────────────────────────────────────────────────────────

function WeekStrip({ weekDates, selectedDate, todayStr, planItemsByDate, weekOffset, onDateSelect, onWeekChange }: {
  weekDates: string[]; selectedDate: string; todayStr: string;
  planItemsByDate: Record<string, PlanItemWithActivity[]>;
  weekOffset: number; onDateSelect: (d: string) => void; onWeekChange: (delta: 1 | -1) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) onWeekChange(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  }, [onWeekChange]);

  const currentWeekDates = getWeekDates(weekDates, weekOffset);

  return (
    <div className="select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onWeekChange(-1)} disabled={weekOffset <= -4}
          className="h-7 w-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-neutral-400 font-medium">
          {(() => {
            const first = new Date(currentWeekDates[0]!);
            const last  = new Date(currentWeekDates[6]!);
            const m1 = MONTHS_FULL[first.getMonth()];
            const m2 = MONTHS_FULL[last.getMonth()];
            return `${m1 === m2 ? m1 : `${m1}–${m2}`} ${last.getFullYear()}`;
          })()}
        </span>
        <button onClick={() => onWeekChange(1)} disabled={weekOffset >= 4}
          className="h-7 w-7 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-30 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {currentWeekDates.map((dateStr) => (
          <DayPill key={dateStr} dateStr={dateStr}
            isSelected={dateStr === selectedDate} isToday={dateStr === todayStr}
            hasItems={(planItemsByDate[dateStr]?.length ?? 0) > 0}
            itemCount={planItemsByDate[dateStr]?.length ?? 0}
            onClick={() => onDateSelect(dateStr)} />
        ))}
      </div>
    </div>
  );
}

// ── Plan item card ────────────────────────────────────────────────────────────

function PlanItemCard({ item, onRemove }: { item: PlanItemWithActivity; onRemove?: () => void }) {
  const activity = item.activity;
  const displayTitle = activity?.title ?? item.title ?? "Активность";
  const displayImage = activity?.coverImageUrl ?? item.coverImageUrl ?? null;
  const availability = getPlanActivityPublicAvailability(activity);
  const unavailable = availability === "business_disabled" || availability === "missing_activity";
  const routeHref =
    !activity?.id && item.planRouteSlug ? `/routes/${item.planRouteSlug}` : null;
  const detailHref = activity?.id
    ? publicActivityPath(activity.id, "minsk", activity.slug)
    : routeHref;

  const formatTime = (dt: Date) =>
    new Date(dt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <Surface variant="soft" className="p-3 flex gap-3 hover:bg-muted/80 transition-colors">
      <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0 overflow-hidden">
        {displayImage
          ? <img src={displayImage} alt={displayTitle} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center bg-primary/10"><span className="text-primary text-lg">📅</span></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <Body className="font-medium line-clamp-1 mb-0.5">{displayTitle}</Body>
        {unavailable && <Caption className="text-amber-800 block mb-0.5">Снято с публикации</Caption>}
        <Caption className="text-muted-foreground">
          {item.startsAt ? formatTime(item.startsAt) : "В любое время"}
        </Caption>
      </div>
      {/* Actions — only what's available */}
      <div className="flex flex-col gap-1 items-end justify-center shrink-0 pl-1">
        {detailHref && (
          <Link href={detailHref} className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors whitespace-nowrap">
            Открыть
          </Link>
        )}
        <button
          onClick={onRemove}
          className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          Удалить
        </button>
      </div>
    </Surface>
  );
}

// ── Day section ───────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: "Утро",   startHour: 0,  endHour: 12 },
  { label: "День",   startHour: 12, endHour: 17 },
  { label: "Вечер",  startHour: 17, endHour: 24 },
];

function getItemHour(item: PlanItemWithActivity): number {
  if (!item.startsAt) return 9; // default to morning
  return new Date(item.startsAt).getHours();
}

function DaySection({ dateStr, items, children, todayStr }: {
  dateStr: string;
  items: PlanItemWithActivity[];
  children: ChildData[];
  todayStr: string;
}) {
  const router = useRouter();
  const isPast = dateStr < todayStr;

  const handleRemove = async (planItemId: string) => {
    await fetch(`/api/save/plan?planItemId=${planItemId}`, { method: "DELETE" });
    router.refresh();
  };

  if (items.length > 0) {
    // Group by time slot
    const grouped = TIME_SLOTS.map((slot) => ({
      ...slot,
      items: items.filter((item) => {
        const h = getItemHour(item);
        return h >= slot.startHour && h < slot.endHour;
      }),
    })).filter((slot) => slot.items.length > 0);

    return (
      <div className="space-y-5">
        {grouped.map((slot) => (
          <div key={slot.label} className="space-y-2">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
              {slot.label}
            </p>
            {slot.items.map((item) => (
              <PlanItemCard key={item.id} item={item} onRemove={() => handleRemove(item.id)} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (isPast) return null;

  return <DayScenarioBlock selectedDate={dateStr}>{children}</DayScenarioBlock>;
}

// ── PlanCard ──────────────────────────────────────────────────────────────────

export function PlanCard({ weekDates, planItemsByDate, selectedDate: initialSelectedDate, children = [] }: PlanCardProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() =>
    initialSelectedDate ?? weekDates.find((d) => planItemsByDate[d]?.length > 0) ?? todayStr,
  );

  const handleWeekChange = useCallback((delta: 1 | -1) => {
    setWeekOffset((prev) => prev + delta);
    const newWeekDates = getWeekDates(weekDates, weekOffset + delta);
    setSelectedDate(newWeekDates[0]!);
  }, [weekDates, weekOffset]);

  const currentItems = planItemsByDate[selectedDate] ?? [];

  return (
    <Surface variant="elevated" className="p-6">
      {/* Header — dynamic title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <H2 className="truncate">{getDayTitle(selectedDate, todayStr)}</H2>
        </div>
        <Link href="/minsk/events"
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" />
          Найти
        </Link>
      </div>

      {/* Week strip */}
      <div className="mb-6">
        <WeekStrip
          weekDates={weekDates}
          selectedDate={selectedDate}
          todayStr={todayStr}
          planItemsByDate={planItemsByDate}
          weekOffset={weekOffset}
          onDateSelect={setSelectedDate}
          onWeekChange={handleWeekChange}
        />
      </div>

      {/* Day content */}
      <DaySection
        dateStr={selectedDate}
        items={currentItems}
        todayStr={todayStr}
      >
        {children}
      </DaySection>
    </Surface>
  );
}
