"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventScheduleCard } from "./EventScheduleCard";
import type { EventScheduleItem, EventScheduleListProps } from "./types";

function createNewScheduleItem(): EventScheduleItem {
  // Use crypto.randomUUID() if available, otherwise fallback to timestamp
  const randomId = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random()}`;
    
  return {
    id: `schedule-${randomId}`,
    isMultiDay: false,
    date: null,
    allDay: false,
    startTime: "10:00",
    endTime: "18:00",
    recurringEnabled: false,
    recurrenceInterval: 1,
    recurrenceUnit: "week",
    recurrenceUntil: null,
    isCollapsed: false,
  };
}

export function EventScheduleList({ items, onChange, disabled = false }: EventScheduleListProps) {
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
    onChange([...items, createNewScheduleItem()]);
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
