"use client";

import { useState, useEffect } from "react";
import { EventScheduleList } from "@/components/admin/event-schedule/EventScheduleList";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
import type { EventFormData } from "../types";

interface Step4DateTimeProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
}

export function Step4DateTime({ data, onChange, isEditable }: Step4DateTimeProps) {
  // Initialize schedule items from data
  const [scheduleItems, setScheduleItems] = useState<EventScheduleItem[]>(() => {
    if (data.dates.length === 0) {
      return [
        {
          id: "default",
          isMultiDay: false,
          date: null,
          allDay: data.allDay,
          startTime: data.startTime || "10:00",
          endTime: data.endTime || "18:00",
          recurringEnabled: data.repeatEnabled,
          recurrenceInterval: 1,
          recurrenceUnit: data.repeatUnit || "week",
          recurrenceUntil: data.repeatUntil,
        },
      ];
    }

    return data.dates.map((date, index) => ({
      id: `date-${index}`,
      isMultiDay: false,
      date,
      allDay: data.allDay,
      startTime: data.startTime || "10:00",
      endTime: data.endTime || "18:00",
      recurringEnabled: data.repeatEnabled,
      recurrenceInterval: 1,
      recurrenceUnit: data.repeatUnit || "week",
      recurrenceUntil: data.repeatUntil,
    }));
  });

  // Sync changes back to EventFormData
  useEffect(() => {
    const dates: string[] = [];
    scheduleItems.forEach((item) => {
      if (item.date) {
        dates.push(item.date);
      }
    });

    const firstItem = scheduleItems[0];
    if (firstItem) {
      onChange({
        dates: dates.length > 0 ? dates : [],
        allDay: firstItem.allDay,
        startTime: firstItem.startTime,
        endTime: firstItem.endTime,
        repeatEnabled: firstItem.recurringEnabled,
        repeatUnit: firstItem.recurrenceUnit,
        repeatUntil: firstItem.recurrenceUntil,
      });
    }
  }, [scheduleItems, onChange]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Дата и время</h2>
        <p className="text-[12px] text-muted-foreground">
          Укажите даты проведения и расписание события
        </p>
      </div>

      <EventScheduleList
        items={scheduleItems}
        onChange={setScheduleItems}
        disabled={!isEditable}
      />
    </div>
  );
}
