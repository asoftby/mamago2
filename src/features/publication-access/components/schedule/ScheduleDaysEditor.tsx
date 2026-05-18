"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScheduleDay, ScheduleSlot } from "../../schedule/types";
import {
  createEmptyScheduleDay,
  createEmptyScheduleSlot,
} from "../../schedule/mappers";
import { ScheduleDayCard } from "./ScheduleDayCard";

type ScheduleDaysEditorProps = {
  days: ScheduleDay[];
  onDaysChange: (days: ScheduleDay[]) => void;
  disabled?: boolean;
  className?: string;
};

export function ScheduleDaysEditor({
  days,
  onDaysChange,
  disabled,
  className,
}: ScheduleDaysEditorProps) {
  const replaceDay = (dayId: string, next: ScheduleDay) => {
    onDaysChange(days.map((d) => (d.id === dayId ? next : d)));
  };

  const patchSlots = (dayId: string, slots: ScheduleSlot[]) => {
    const d = days.find((x) => x.id === dayId);
    if (!d) return;
    replaceDay(dayId, { ...d, slots });
  };

  const addDay = () => {
    const next = createEmptyScheduleDay();
    onDaysChange([...days, next]);
  };

  const removeDay = (dayId: string) => {
    onDaysChange(days.filter((d) => d.id !== dayId));
  };

  const addSlotToDay = (dayId: string) => {
    const d = days.find((x) => x.id === dayId);
    if (!d) return;
    replaceDay(dayId, { ...d, slots: [...d.slots, createEmptyScheduleSlot()] });
  };

  const updateSlot = (dayId: string, slotId: string, patch: Partial<ScheduleSlot>) => {
    const d = days.find((x) => x.id === dayId);
    if (!d) return;
    patchSlots(
      dayId,
      d.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
    );
  };

  const removeSlot = (dayId: string, slotId: string) => {
    const d = days.find((x) => x.id === dayId);
    if (!d) return;
    patchSlots(
      dayId,
      d.slots.filter((s) => s.id !== slotId),
    );
  };

  if (days.length === 0) {
    return (
      <div className={cn("space-y-6", className)}>
        <p className="text-sm text-muted-foreground">
          Добавьте дни, когда можно записаться. Каждый день — одна карточка с собственными
          временными слотами.
        </p>
        <Button
          type="button"
          variant="ghost"
          className="w-full rounded-2xl border border-dashed border-stone-300 text-stone-600 hover:border-primary/35 hover:bg-primary/5 hover:text-primary"
          onClick={addDay}
          disabled={disabled}
        >
          + Добавить день
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {days.map((day) => (
        <ScheduleDayCard
          key={day.id}
          day={day}
          onDayUpdate={(next) => replaceDay(day.id, next)}
          onAddSlot={() => addSlotToDay(day.id)}
          onRemoveDay={days.length > 1 ? () => removeDay(day.id) : undefined}
          onUpdateSlot={(slotId, patch) => updateSlot(day.id, slotId, patch)}
          onRemoveSlot={(slotId) => removeSlot(day.id, slotId)}
          disabled={disabled}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        className="w-full rounded-2xl border border-dashed border-stone-300 text-stone-600 hover:border-primary/35 hover:bg-primary/5 hover:text-primary"
        onClick={addDay}
        disabled={disabled}
      >
        + Добавить день
      </Button>
    </div>
  );
}
