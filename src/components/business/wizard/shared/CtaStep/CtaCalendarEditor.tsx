"use client";

import { CalendarDays, Clock3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StableCardSelectorSmall } from "@/components/ui/stable-card-selector";
import { cn } from "@/lib/utils";
import {
  createEmptyCtaCalendarDay,
  createEmptyCtaCalendarSlot,
} from "./model";
import type {
  CtaStepCalendarDay,
  CtaStepCalendarMode,
} from "./types";

type CtaCalendarEditorProps = {
  days: CtaStepCalendarDay[];
  mode: CtaStepCalendarMode;
  disabled?: boolean;
  onModeChange: (mode: CtaStepCalendarMode) => void;
  onChange: (days: CtaStepCalendarDay[]) => void;
};

function parseOptionalPositiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function ensureDays(days: CtaStepCalendarDay[]): CtaStepCalendarDay[] {
  return days.length > 0 ? days : [createEmptyCtaCalendarDay()];
}

export function CtaCalendarEditor({
  days,
  mode,
  disabled,
  onModeChange,
  onChange,
}: CtaCalendarEditorProps) {
  const safeDays = ensureDays(days);

  const patchDay = (dayId: string, updater: (day: CtaStepCalendarDay) => CtaStepCalendarDay) => {
    onChange(safeDays.map((day) => (day.id === dayId ? updater(day) : day)));
  };

  const addDay = () => {
    onChange([...safeDays, createEmptyCtaCalendarDay()]);
  };

  const removeDay = (dayId: string) => {
    const nextDays = safeDays.filter((day) => day.id !== dayId);
    onChange(nextDays.length > 0 ? nextDays : [createEmptyCtaCalendarDay()]);
  };

  const addSlot = (dayId: string) => {
    patchDay(dayId, (day) => ({
      ...day,
      slots: [...day.slots, createEmptyCtaCalendarSlot()],
    }));
  };

  const removeSlot = (dayId: string, slotId: string) => {
    patchDay(dayId, (day) => {
      const nextSlots = day.slots.filter((slot) => slot.id !== slotId);
      return {
        ...day,
        slots: nextSlots.length > 0 ? nextSlots : [createEmptyCtaCalendarSlot()],
      };
    });
  };

  return (
    <section className="space-y-4" aria-labelledby="cta-calendar-title">
      <div className="space-y-1">
        <h3
          id="cta-calendar-title"
          className="text-base font-semibold text-foreground"
        >
          Настроить календарь
        </h3>
        <p className="text-sm text-muted-foreground">
          Это один календарь с двумя режимами: только даты или даты и время.
        </p>
      </div>

      <StableCardSelectorSmall
        value={mode}
        onValueChange={onModeChange}
        isEditable={!disabled}
        className="space-y-3"
        options={[
          {
            value: "DATE_ONLY",
            label: "Только даты",
            description: "Пользователь выбирает день, а детали вы согласуете после заявки.",
            icon: CalendarDays,
          },
          {
            value: "DATE_AND_TIME",
            label: "Даты и время",
            description: "Пользователь выбирает конкретную дату и свободный слот.",
            icon: Clock3,
          },
        ]}
      />

      <div className="space-y-4">
        {safeDays.map((day, dayIndex) => (
          <Card key={day.id} className="gap-0 rounded-2xl border-border py-0 shadow-none">
            <CardHeader className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-sm">День {dayIndex + 1}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mode === "DATE_ONLY"
                      ? "Добавьте дату и, при необходимости, лимит мест."
                      : "Добавьте дату и доступные временные слоты."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeDay(day.id)}
                  disabled={disabled}
                  aria-label={`Удалить день ${dayIndex + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-5 py-4">
              <div className={cn("grid gap-4", mode === "DATE_ONLY" ? "md:grid-cols-2" : "md:grid-cols-1")}>
                <div className="space-y-2">
                  <Label htmlFor={`cta-day-date-${day.id}`}>Дата</Label>
                  <Input
                    id={`cta-day-date-${day.id}`}
                    type="date"
                    value={day.date}
                    disabled={disabled}
                    onChange={(event) =>
                      patchDay(day.id, (currentDay) => ({
                        ...currentDay,
                        date: event.target.value,
                      }))
                    }
                  />
                </div>

                {mode === "DATE_ONLY" ? (
                  <div className="space-y-2">
                    <Label htmlFor={`cta-day-capacity-${day.id}`}>Мест на дату</Label>
                    <Input
                      id={`cta-day-capacity-${day.id}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={day.capacity ?? ""}
                      placeholder="Например, 10"
                      disabled={disabled}
                      onChange={(event) =>
                        patchDay(day.id, (currentDay) => ({
                          ...currentDay,
                          capacity: parseOptionalPositiveNumber(event.target.value),
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>

              {mode === "DATE_AND_TIME" ? (
                <div className="space-y-3">
                  {day.slots.map((slot, slotIndex) => (
                    <div
                      key={slot.id}
                      className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Слот {slotIndex + 1}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeSlot(day.id, slot.id)}
                          disabled={disabled}
                          aria-label={`Удалить слот ${slotIndex + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`cta-slot-start-${slot.id}`}>Начало</Label>
                          <Input
                            id={`cta-slot-start-${slot.id}`}
                            type="time"
                            value={slot.startTime}
                            disabled={disabled}
                            onChange={(event) =>
                              patchDay(day.id, (currentDay) => ({
                                ...currentDay,
                                slots: currentDay.slots.map((currentSlot) =>
                                  currentSlot.id === slot.id
                                    ? { ...currentSlot, startTime: event.target.value }
                                    : currentSlot,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cta-slot-end-${slot.id}`}>Окончание</Label>
                          <Input
                            id={`cta-slot-end-${slot.id}`}
                            type="time"
                            value={slot.endTime}
                            disabled={disabled}
                            onChange={(event) =>
                              patchDay(day.id, (currentDay) => ({
                                ...currentDay,
                                slots: currentDay.slots.map((currentSlot) =>
                                  currentSlot.id === slot.id
                                    ? { ...currentSlot, endTime: event.target.value }
                                    : currentSlot,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cta-slot-capacity-${slot.id}`}>Мест</Label>
                          <Input
                            id={`cta-slot-capacity-${slot.id}`}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={slot.capacity ?? ""}
                            placeholder="5"
                            disabled={disabled}
                            onChange={(event) =>
                              patchDay(day.id, (currentDay) => ({
                                ...currentDay,
                                slots: currentDay.slots.map((currentSlot) =>
                                  currentSlot.id === slot.id
                                    ? {
                                        ...currentSlot,
                                        capacity: parseOptionalPositiveNumber(event.target.value),
                                      }
                                    : currentSlot,
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSlot(day.id)}
                    disabled={disabled}
                    className="min-h-11 rounded-xl"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить слот
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDay}
          disabled={disabled}
          className="min-h-11 rounded-xl"
        >
          <Plus className="h-4 w-4" />
          Добавить день
        </Button>
      </div>
    </section>
  );
}
