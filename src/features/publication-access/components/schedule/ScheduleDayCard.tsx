"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { ScheduleDay, ScheduleSlot } from "../../schedule/types";
import { AddSlotButton } from "./AddSlotButton";
import {
  ScheduleDayDateField,
  ScheduleDayHeader,
} from "./ScheduleDayHeader";
import { ScheduleDayFooterStats, ScheduleSlotsList } from "./ScheduleSlotsList";

export type ScheduleDayCardProps = {
  day: ScheduleDay;
  onDayUpdate: (next: ScheduleDay) => void;
  onAddSlot: () => void;
  onRemoveDay?: () => void;
  onUpdateSlot: (slotId: string, patch: Partial<ScheduleSlot>) => void;
  onRemoveSlot: (slotId: string) => void;
  disabled?: boolean;
};

export function ScheduleDayCard({
  day,
  onDayUpdate,
  onAddSlot,
  onRemoveDay,
  onUpdateSlot,
  onRemoveSlot,
  disabled,
}: ScheduleDayCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const headingId = useId();

  const maxCapacity =
    day.slots.length > 0 ? Math.max(...day.slots.map((s) => s.capacity || 0), 0) : null;

  const handleDateChange = (iso: string) => {
    const nextId = iso ? `day-${iso}` : day.id;
    onDayUpdate({ ...day, date: iso, id: nextId });
  };

  return (
    <section
      className={cn(
        "rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm",
        "transition-shadow hover:shadow-md",
      )}
      aria-labelledby={headingId}
    >
      <ScheduleDayHeader
        dateStr={day.date}
        slotCount={day.slots.length}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onAddSlot={onAddSlot}
        onRemoveDay={onRemoveDay}
        disabled={disabled}
        dayLabelId={headingId}
      />

      <div className="mt-5">
        <ScheduleDayDateField
          dayId={day.id}
          value={day.date}
          onChange={handleDateChange}
          disabled={disabled}
          labelledBy={headingId}
        />
      </div>

      {!collapsed ? (
        <div className="mt-6 space-y-5">
          <ScheduleSlotsList
            slots={day.slots}
            onUpdateSlot={onUpdateSlot}
            onRemoveSlot={onRemoveSlot}
            disabled={disabled}
          />
          <AddSlotButton onClick={onAddSlot} disabled={disabled} />
          <ScheduleDayFooterStats slotCount={day.slots.length} maxCapacity={maxCapacity} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Разверните карточку, чтобы увидеть и изменить слоты.
        </p>
      )}
    </section>
  );
}
