"use client";

import { CalendarDays, ChevronDown, ChevronUp, MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function formatScheduleDayHeading(dateStr: string): { weekday: string; long: string } {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { weekday: "День", long: "Укажите дату" };
  }
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { weekday: "День", long: dateStr };
  }
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long" }).format(d);
  const long = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return { weekday: capWeekday, long };
}

type ScheduleDayHeaderProps = {
  dateStr: string;
  slotCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onAddSlot: () => void;
  onRemoveDay?: () => void;
  disabled?: boolean;
  dayLabelId: string;
};

export function ScheduleDayHeader({
  dateStr,
  slotCount,
  collapsed,
  onToggleCollapse,
  onAddSlot,
  onRemoveDay,
  disabled,
  dayLabelId,
}: ScheduleDayHeaderProps) {
  const { weekday, long } = formatScheduleDayHeading(dateStr);
  const slotWord =
    slotCount === 0
      ? "нет слотов"
      : slotCount === 1
        ? "1 слот"
        : slotCount < 5
          ? `${slotCount} слота`
          : `${slotCount} слотов`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            "bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          <CalendarDays className="h-6 w-6" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p id={dayLabelId} className="font-semibold capitalize leading-tight text-stone-900">
            {weekday}
          </p>
          <p className="text-sm text-muted-foreground">{long}</p>
          <p className="text-sm font-medium text-primary">{slotWord}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-primary/25 text-primary hover:bg-primary/10"
          onClick={onAddSlot}
          disabled={disabled}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Добавить слот
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl text-muted-foreground hover:text-stone-900"
          onClick={onToggleCollapse}
          disabled={disabled}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Развернуть слоты" : "Свернуть слоты"}
        >
          {collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
        </Button>
        {onRemoveDay ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-stone-900"
                disabled={disabled}
                aria-label="Действия с днём"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onRemoveDay}
              >
                Удалить день
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

type ScheduleDayDateFieldProps = {
  dayId: string;
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  labelledBy?: string;
};

export function ScheduleDayDateField({
  dayId,
  value,
  onChange,
  disabled,
  labelledBy,
}: ScheduleDayDateFieldProps) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={`day-date-${dayId}`}
        className="text-xs font-medium text-muted-foreground"
      >
        Дата расписания
      </Label>
      <Input
        id={`day-date-${dayId}`}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="max-w-[220px] rounded-xl border-stone-200 bg-white"
        aria-labelledby={labelledBy}
      />
    </div>
  );
}
