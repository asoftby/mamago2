"use client";

import { Clock, Users } from "lucide-react";
import type { ScheduleSlot } from "../../schedule/types";
import { ScheduleSlotRow } from "./ScheduleSlotRow";

type ScheduleSlotsListProps = {
  slots: ScheduleSlot[];
  onUpdateSlot: (slotId: string, patch: Partial<ScheduleSlot>) => void;
  onRemoveSlot: (slotId: string) => void;
  disabled?: boolean;
};

export function ScheduleSlotsList({
  slots,
  onUpdateSlot,
  onRemoveSlot,
  disabled,
}: ScheduleSlotsListProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-200/80 bg-stone-50/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Пока нет временных слотов — нажмите «Добавить слот» выше или внизу карточки.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" role="list">
      {slots.map((slot) => (
        <li key={slot.id}>
          <ScheduleSlotRow
            slot={slot}
            onChange={(patch) => onUpdateSlot(slot.id, patch)}
            onRemove={() => onRemoveSlot(slot.id)}
            disabled={disabled}
          />
        </li>
      ))}
    </ul>
  );
}

type ScheduleDayFooterStatsProps = {
  slotCount: number;
  maxCapacity: number | null;
};

export function ScheduleDayFooterStats({ slotCount, maxCapacity }: ScheduleDayFooterStatsProps) {
  if (slotCount === 0) return null;

  const capPhrase =
    maxCapacity != null && maxCapacity > 0
      ? `До ${maxCapacity} мест в слоте`
      : "Укажите вместимость слотов";

  return (
    <div className="flex flex-col gap-1 border-t border-stone-100 pt-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
      <p className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <span>
          Всего <strong className="font-semibold text-stone-800">{slotCount}</strong>{" "}
          {slotCount === 1 ? "слот" : slotCount < 5 ? "слота" : "слотов"}
        </span>
      </p>
      <p className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <span>{capPhrase}</span>
      </p>
    </div>
  );
}
