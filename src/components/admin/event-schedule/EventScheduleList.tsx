"use client";

import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventScheduleCard } from "./EventScheduleCard";
import { randomId } from "@/lib/utils/randomId";
import type { EventScheduleItem, EventScheduleListProps } from "./types";

function addMinutesToTime(time: string, durationMinutes?: number): string {
  if (!durationMinutes || durationMinutes < 1) return "18:00";
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return "18:00";
  const total = (Number(match[1]) * 60 + Number(match[2]) + durationMinutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function createNewScheduleItem(durationMinutes?: number): EventScheduleItem {
  return {
    id: `schedule-${randomId()}`,
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "10:00",
    endTime: addMinutesToTime("10:00", durationMinutes),
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "week",
    recurrenceUntil: null,
    isCollapsed: false,
  };
}

export function EventScheduleList({
  items,
  onChange,
  disabled = false,
  durationMinutes,
}: EventScheduleListProps) {
  const lastDurationInput = useRef<string | null>(null);

  useEffect(() => {
    const inputKey = `${durationMinutes ?? ""}|${items
      .map((item) => `${item.id}:${item.startTime}:${item.allDay}`)
      .join("|")}`;
    if (lastDurationInput.current === inputKey) return;
    lastDurationInput.current = inputKey;
    if (!durationMinutes || durationMinutes < 1) return;

    let changed = false;
    const nextItems = items.map((item) => {
      if (item.allDay) return item;
      const endTime = addMinutesToTime(item.startTime, durationMinutes);
      if (endTime === item.endTime) return item;
      changed = true;
      return { ...item, endTime };
    });

    if (changed) onChange(nextItems);
  }, [durationMinutes, items, onChange]);

  const handleItemChange = (index: number, updatedItem: EventScheduleItem) => {
    const newItems = [...items];
    newItems[index] = updatedItem;
    onChange(newItems);
  };

  const handleItemRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleAddItem = () => {
    onChange([...items, createNewScheduleItem(durationMinutes)]);
  };

  return (
    <div className="space-y-4">
      {/* Schedule Cards */}
      {items.map((item, index) => (
        <EventScheduleCard
          key={item.id}
          item={item}
          onChange={(updated) => handleItemChange(index, updated)}
          onRemove={() => handleItemRemove(index)}
          canRemove={items.length > 1}
          disabled={disabled}
          durationMinutes={durationMinutes}
        />
      ))}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddItem}
        className="w-full border-dashed border-2 h-12 text-gray-600 hover:text-gray-900 hover:border-gray-400"
        disabled={disabled}
      >
        <Plus className="w-4 h-4 mr-2" />
        Добавить дату
      </Button>
    </div>
  );
}
