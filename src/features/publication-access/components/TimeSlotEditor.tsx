"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicationAccessTimeSlot } from "../types";
import {
  flatSlotsToGroupedDays,
  groupedDaysToFlatSlots,
} from "../schedule/mappers";
import type { ScheduleDay } from "../schedule/types";
import { ScheduleDaysEditor } from "./schedule/ScheduleDaysEditor";

type TimeSlotEditorProps = {
  value: PublicationAccessTimeSlot[];
  onChange: (value: PublicationAccessTimeSlot[]) => void;
  disabled?: boolean;
};

function serializeSlots(s: PublicationAccessTimeSlot[]): string {
  return JSON.stringify(s);
}

/** Только завершённые слоты уходят в форму/API (дата + время начала). */
function toPersistedSlots(days: ScheduleDay[]): PublicationAccessTimeSlot[] {
  return groupedDaysToFlatSlots(days).filter(
    (slot) => slot.date?.trim() && slot.startTime?.trim(),
  );
}

export function TimeSlotEditor({
  value,
  onChange,
  disabled,
}: TimeSlotEditorProps) {
  const valueKey = serializeSlots(value);
  const lastEmitted = useRef(valueKey);
  const [days, setDays] = useState<ScheduleDay[]>(() => flatSlotsToGroupedDays(value));

  /* eslint-disable react-hooks/set-state-in-effect -- resync grouped UI when parent replaces slots (load from server / other step) */
  useEffect(() => {
    if (valueKey === lastEmitted.current) return;
    lastEmitted.current = valueKey;
    setDays(flatSlotsToGroupedDays(value));
  }, [value, valueKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDaysChange = useCallback(
    (next: ScheduleDay[]) => {
      setDays(next);
      const flat = toPersistedSlots(next);
      const key = serializeSlots(flat);
      lastEmitted.current = key;
      onChange(flat);
    },
    [onChange],
  );

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-stone-900">Расписание слотов</div>
      <ScheduleDaysEditor
        days={days}
        onDaysChange={handleDaysChange}
        disabled={disabled}
      />
    </div>
  );
}
