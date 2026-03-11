"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DayScheduleEditor } from "./DayScheduleEditor";
import {
  ALL_DAYS,
  WEEKDAYS,
  WEEKEND_DAYS,
  MODE_LABELS,
} from "./openingHours.types";
import type { OpeningHoursData, DayRule } from "./openingHours.types";
import type { OpeningHoursMode } from "@prisma/client";

interface OpeningHoursEditorProps {
  value: OpeningHoursData | null;
  onChange: (value: OpeningHoursData) => void;
  timezone?: string;
  disabled?: boolean;
}

/**
 * Create default opening hours data
 */
function createDefaultData(timezone: string): OpeningHoursData {
  return {
    mode: "WEEKLY",
    timezone,
    rules: ALL_DAYS.map((day) => ({
      dayOfWeek: day,
      isOpen: !WEEKEND_DAYS.includes(day),
      allDay: false,
      intervals: !WEEKEND_DAYS.includes(day)
        ? [{ startTime: "09:00", endTime: "18:00" }]
        : [],
    })),
  };
}

/**
 * OpeningHoursEditor component
 * Controlled component for editing opening hours
 */
export function OpeningHoursEditor({
  value,
  onChange,
  timezone = "Europe/Minsk",
  disabled = false,
}: OpeningHoursEditorProps) {
  const data = value || createDefaultData(timezone);

  const handleModeChange = (mode: OpeningHoursMode) => {
    onChange({ ...data, mode });
  };

  const handleNoteChange = (note: string) => {
    onChange({ ...data, note: note || undefined });
  };

  const handleDayChange = (updatedDay: DayRule) => {
    const newRules = data.rules.map((rule) =>
      rule.dayOfWeek === updatedDay.dayOfWeek ? updatedDay : rule
    );
    onChange({ ...data, rules: newRules });
  };

  const handleCopyToAll = () => {
    const firstDay = data.rules[0];
    const newRules = data.rules.map((rule) => ({
      ...rule,
      isOpen: firstDay.isOpen,
      allDay: firstDay.allDay,
      intervals: [...firstDay.intervals],
    }));
    onChange({ ...data, rules: newRules });
  };

  const handleCopyWeekdays = () => {
    const monday = data.rules.find((r) => r.dayOfWeek === "MON");
    if (!monday) return;

    const newRules = data.rules.map((rule) =>
      WEEKDAYS.includes(rule.dayOfWeek)
        ? {
            ...rule,
            isOpen: monday.isOpen,
            allDay: monday.allDay,
            intervals: [...monday.intervals],
          }
        : rule
    );
    onChange({ ...data, rules: newRules });
  };

  const handleCopyWeekends = () => {
    const saturday = data.rules.find((r) => r.dayOfWeek === "SAT");
    if (!saturday) return;

    const newRules = data.rules.map((rule) =>
      WEEKEND_DAYS.includes(rule.dayOfWeek)
        ? {
            ...rule,
            isOpen: saturday.isOpen,
            allDay: saturday.allDay,
            intervals: [...saturday.intervals],
          }
        : rule
    );
    onChange({ ...data, rules: newRules });
  };

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="space-y-2">
        <Label>Режим работы</Label>
        <Select value={data.mode} onValueChange={handleModeChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="WEEKLY">{MODE_LABELS.WEEKLY}</SelectItem>
            <SelectItem value="ALWAYS_OPEN">{MODE_LABELS.ALWAYS_OPEN}</SelectItem>
            <SelectItem value="BY_APPOINTMENT">{MODE_LABELS.BY_APPOINTMENT}</SelectItem>
            <SelectItem value="TEMPORARILY_CLOSED">{MODE_LABELS.TEMPORARILY_CLOSED}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Note field for TEMPORARILY_CLOSED */}
      {data.mode === "TEMPORARILY_CLOSED" && (
        <div className="space-y-2">
          <Label>Примечание</Label>
          <Textarea
            value={data.note || ""}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Например: Закрыто на ремонт до 15 марта"
            rows={2}
            disabled={disabled}
          />
        </div>
      )}

      {/* Weekly schedule */}
      {data.mode === "WEEKLY" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Недельный график</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyToAll}
                disabled={disabled}
              >
                Скопировать на все дни
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyWeekdays}
                disabled={disabled}
              >
                Будни
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyWeekends}
                disabled={disabled}
              >
                Выходные
              </Button>
            </div>
          </div>

          <div className="border rounded-lg">
            {data.rules.map((day) => (
              <DayScheduleEditor
                key={day.dayOfWeek}
                day={day}
                onChange={handleDayChange}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}

      {/* Info messages for special modes */}
      {data.mode === "ALWAYS_OPEN" && (
        <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
          Место работает круглосуточно, без выходных
        </div>
      )}

      {data.mode === "BY_APPOINTMENT" && (
        <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
          Посещение только по предварительной записи
        </div>
      )}
    </div>
  );
}
