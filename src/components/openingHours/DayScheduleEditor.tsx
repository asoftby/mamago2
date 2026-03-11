"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { TimePicker } from "./TimePicker";
import { DAY_LABELS } from "./openingHours.types";
import type { DayRule, TimeInterval } from "./openingHours.types";

interface DayScheduleEditorProps {
  day: DayRule;
  onChange: (day: DayRule) => void;
  disabled?: boolean;
}

/**
 * DayScheduleEditor component
 * Edits schedule for a single day
 */
export function DayScheduleEditor({ day, onChange, disabled = false }: DayScheduleEditorProps) {
  const handleOpenToggle = (checked: boolean) => {
    onChange({
      ...day,
      isOpen: checked,
      allDay: false,
      intervals: checked ? [{ startTime: "09:00", endTime: "18:00" }] : [],
    });
  };

  const handleAllDayToggle = (checked: boolean) => {
    onChange({
      ...day,
      allDay: checked,
      intervals: [],
    });
  };

  const handleIntervalChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newIntervals = [...day.intervals];
    newIntervals[index] = { ...newIntervals[index], [field]: value };
    onChange({ ...day, intervals: newIntervals });
  };

  const handleAddInterval = () => {
    if (day.intervals.length < 2) {
      onChange({
        ...day,
        intervals: [...day.intervals, { startTime: "14:00", endTime: "18:00" }],
      });
    }
  };

  const handleRemoveInterval = (index: number) => {
    onChange({
      ...day,
      intervals: day.intervals.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-b-0">
      {/* Day label */}
      <div className="w-32 pt-2 pl-4 font-medium text-sm">{DAY_LABELS[day.dayOfWeek]}</div>

      {/* Open/Closed toggle */}
      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          id={`open-${day.dayOfWeek}`}
          checked={day.isOpen}
          onCheckedChange={handleOpenToggle}
          disabled={disabled}
        />
        <label htmlFor={`open-${day.dayOfWeek}`} className="text-sm cursor-pointer">
          Открыто
        </label>
      </div>

      {/* Schedule controls */}
      <div className="flex-1">
        {!day.isOpen && (
          <div className="pt-2 text-sm text-muted-foreground">Выходной</div>
        )}

        {day.isOpen && (
          <div className="space-y-3">
            {/* All day toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id={`allday-${day.dayOfWeek}`}
                checked={day.allDay}
                onCheckedChange={handleAllDayToggle}
                disabled={disabled}
              />
              <label htmlFor={`allday-${day.dayOfWeek}`} className="text-sm cursor-pointer">
                Круглосуточно
              </label>
            </div>

            {/* Time intervals */}
            {!day.allDay && (
              <div className="space-y-2">
                {day.intervals.map((interval, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <TimePicker
                      value={interval.startTime}
                      onChange={(value) => handleIntervalChange(index, "startTime", value)}
                      disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">—</span>
                    <TimePicker
                      value={interval.endTime}
                      onChange={(value) => handleIntervalChange(index, "endTime", value)}
                      disabled={disabled}
                    />
                    {day.intervals.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInterval(index)}
                        disabled={disabled}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* Add interval button */}
                {day.intervals.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddInterval}
                    disabled={disabled}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить интервал
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
