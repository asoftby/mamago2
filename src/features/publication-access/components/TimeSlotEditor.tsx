"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Info,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PublicationAccessTimeSlot, PublicationEntityType } from "../types";
import {
  createEmptyScheduleDay,
  createEmptyScheduleSlot,
  flatSlotsToGroupedDays,
  groupedDaysToFlatSlots,
} from "../schedule/mappers";
import type { ScheduleDay, ScheduleSlot } from "../schedule/types";
import { ScheduleSlotRow } from "./schedule/ScheduleSlotRow";

type TimeSlotEditorProps = {
  entityType: PublicationEntityType;
  value: PublicationAccessTimeSlot[];
  onChange: (value: PublicationAccessTimeSlot[]) => void;
  disabled?: boolean;
};

type SlotField = "startTime" | "endTime" | "capacity";
type SlotErrors = Partial<Record<SlotField, string>>;
type DayTouched = {
  date?: boolean;
  slots: Record<string, Partial<Record<SlotField, boolean>>>;
};

function serializeSlots(slots: PublicationAccessTimeSlot[]): string {
  return JSON.stringify(slots);
}

function createDateSlotBlock(): ScheduleDay {
  const day = createEmptyScheduleDay();
  return {
    ...day,
    slots: [createEmptyScheduleSlot()],
  };
}

function normalizeEditorDays(days: ScheduleDay[]): ScheduleDay[] {
  const source = days.length > 0 ? days : [createDateSlotBlock()];
  return source.map((day) => ({
    ...day,
    slots: day.slots.length > 0 ? day.slots : [createEmptyScheduleSlot()],
  }));
}

function sortDays(days: ScheduleDay[]): ScheduleDay[] {
  return [...days].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
}

function toPersistedSlots(days: ScheduleDay[]): PublicationAccessTimeSlot[] {
  return groupedDaysToFlatSlots(days).filter((slot) => {
    const capacityValid = typeof slot.capacity === "number" && slot.capacity > 0;
    return Boolean(
      slot.date?.trim() &&
        slot.startTime?.trim() &&
        slot.endTime?.trim() &&
        capacityValid,
    );
  });
}

function getEntityHintLabel(entityType: PublicationEntityType): string {
  return entityType === "offer"
    ? "Выберите день, когда откроется запись на предложение."
    : "Выберите день, на который откроется запись.";
}

function buildSlotErrors(slot: ScheduleSlot): SlotErrors {
  const errors: SlotErrors = {};
  if (!slot.startTime) errors.startTime = "Укажите время начала";
  if (!slot.endTime) errors.endTime = "Укажите время окончания";
  if (slot.startTime && slot.endTime && slot.endTime <= slot.startTime) {
    errors.endTime = "Окончание должно быть позже начала";
  }
  if (slot.capacity == null || slot.capacity <= 0) {
    errors.capacity = "Введите число больше 0";
  }
  return errors;
}

export function TimeSlotEditor({
  entityType,
  value,
  onChange,
  disabled,
}: TimeSlotEditorProps) {
  const initialDays = useMemo(
    () => normalizeEditorDays(flatSlotsToGroupedDays(value)),
    [value],
  );
  const valueKey = serializeSlots(value);
  const lastEmitted = useRef(valueKey);
  const [days, setDays] = useState<ScheduleDay[]>(initialDays);
  const [touched, setTouched] = useState<Record<string, DayTouched>>({});

  /* eslint-disable react-hooks/set-state-in-effect -- editor resyncs local grouped state when parent replaces slots */
  useEffect(() => {
    if (valueKey === lastEmitted.current) return;
    const nextDays = normalizeEditorDays(flatSlotsToGroupedDays(value));
    lastEmitted.current = valueKey;
    setDays(nextDays);
  }, [value, valueKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const commitDays = useCallback(
    (nextDays: ScheduleDay[]) => {
      const normalizedDays = normalizeEditorDays(sortDays(nextDays));
      setDays(normalizedDays);

      const flat = toPersistedSlots(normalizedDays);
      const key = serializeSlots(flat);
      lastEmitted.current = key;
      onChange(flat);
    },
    [onChange],
  );

  const patchDay = useCallback(
    (dayId: string, updater: (day: ScheduleDay) => ScheduleDay) => {
      commitDays(days.map((day) => (day.id === dayId ? updater(day) : day)));
    },
    [commitDays, days],
  );

  const markDateTouched = useCallback((dayId: string) => {
    setTouched((prev) => ({
      ...prev,
      [dayId]: {
        date: true,
        slots: prev[dayId]?.slots ?? {},
      },
    }));
  }, []);

  const markSlotTouched = useCallback((dayId: string, slotId: string, field: SlotField) => {
    setTouched((prev) => ({
      ...prev,
      [dayId]: {
        date: prev[dayId]?.date,
        slots: {
          ...(prev[dayId]?.slots ?? {}),
          [slotId]: {
            ...(prev[dayId]?.slots?.[slotId] ?? {}),
            [field]: true,
          },
        },
      },
    }));
  }, []);

  const handleAddDay = () => {
    commitDays([...days, createDateSlotBlock()]);
  };

  const handleRemoveDay = (dayId: string) => {
    if (days.length <= 1) return;
    setTouched((prev) => {
      const next = { ...prev };
      delete next[dayId];
      return next;
    });
    commitDays(days.filter((day) => day.id !== dayId));
  };

  const handleResetAll = () => {
    setTouched({});
    commitDays([createDateSlotBlock()]);
  };

  const sectionTitle = "Даты и слоты";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-foreground">{sectionTitle}</h4>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              Выберите дату и добавьте слоты, в которые гости смогут записаться.
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={disabled}
              className="rounded-xl border-border text-muted-foreground hover:border-primary hover:text-primary focus-visible:ring-primary/20"
              aria-label="Дополнительные действия"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={handleAddDay} disabled={disabled}>
              Добавить дату и слоты
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleResetAll} disabled={disabled}>
              Сбросить всё
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {days.map((day, index) => {
          const dayTouched = touched[day.id];
          const showDateError = Boolean(dayTouched?.date && !day.date);

          return (
            <Card
              key={day.id}
              className="gap-0 rounded-2xl border-border bg-background py-0 shadow-none transition-colors hover:border-primary/30"
            >
              <CardContent className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="text-[14px] font-semibold text-foreground">
                      Блок {index + 1}
                    </h5>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {entityType === "offer"
                        ? "Одна дата предложения и несколько слотов записи."
                        : "Одна дата события и несколько слотов записи."}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled || days.length <= 1}
                    onClick={() => handleRemoveDay(day.id)}
                    className="rounded-xl text-muted-foreground hover:bg-primary/5 hover:text-primary"
                    aria-label="Удалить блок даты"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-[12px] font-medium text-foreground">Дата</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    <Input
                      type="date"
                      value={day.date}
                      onChange={(event) =>
                        patchDay(day.id, (current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      onBlur={() => markDateTouched(day.id)}
                      disabled={disabled}
                      aria-invalid={showDateError ? "true" : "false"}
                      className={cn(
                        "h-11 rounded-xl border-border bg-background pl-10 pr-10 text-[12px] focus-visible:border-primary focus-visible:ring-primary/20 [color-scheme:light]",
                        !day.date && "text-muted-foreground",
                      )}
                    />
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                  </div>
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    {getEntityHintLabel(entityType)}
                  </p>
                  {showDateError ? (
                    <p className="text-[11px] leading-4 text-primary">Выберите дату</p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-[12px] font-medium text-foreground">Слоты</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        patchDay(day.id, (current) => ({
                          ...current,
                          slots: [...current.slots, createEmptyScheduleSlot()],
                        }))
                      }
                      disabled={disabled}
                      className="h-9 rounded-xl border-primary/30 bg-background text-[12px] font-semibold text-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-primary/20"
                    >
                      <Plus className="h-4 w-4" />
                      Добавить слот
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {day.slots.map((slot) => {
                      const rawErrors = buildSlotErrors(slot);
                      const touchedFields = dayTouched?.slots?.[slot.id] ?? {};
                      const visibleErrors: SlotErrors = {};

                      if (touchedFields.startTime && rawErrors.startTime) {
                        visibleErrors.startTime = rawErrors.startTime;
                      }
                      if (touchedFields.endTime && rawErrors.endTime) {
                        visibleErrors.endTime = rawErrors.endTime;
                      }
                      if (touchedFields.capacity && rawErrors.capacity) {
                        visibleErrors.capacity = rawErrors.capacity;
                      }

                      return (
                        <ScheduleSlotRow
                          key={slot.id}
                          slot={slot}
                          errors={visibleErrors}
                          canRemove={day.slots.length > 1}
                          onBlurField={(field) => markSlotTouched(day.id, slot.id, field)}
                          onChange={(patch) =>
                            patchDay(day.id, (current) => ({
                              ...current,
                              slots: current.slots.map((item) =>
                                item.id === slot.id ? { ...item, ...patch } : item,
                              ),
                            }))
                          }
                          onRemove={() =>
                            patchDay(day.id, (current) => ({
                              ...current,
                              slots:
                                current.slots.length > 1
                                  ? current.slots.filter((item) => item.id !== slot.id)
                                  : current.slots,
                            }))
                          }
                          disabled={disabled}
                        />
                      );
                    })}
                  </div>

                  {day.slots.length === 1 &&
                  !day.slots[0]?.startTime &&
                  !day.slots[0]?.endTime &&
                  day.slots[0]?.capacity == null ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-[12px] leading-5 text-muted-foreground">
                      Начните с выбора даты, затем укажите время начала, окончания и вместимость
                      для первого слота.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="border-t border-border px-5 py-5 sm:px-6">
        <Button
          type="button"
          onClick={handleAddDay}
          disabled={disabled}
          className="h-11 w-full rounded-xl bg-primary text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/20"
        >
          <Plus className="h-4 w-4" />
          Добавить дату и слоты
        </Button>
      </div>

      <div className="border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
        <p className="flex items-start gap-2.5 text-[12px] leading-5 text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">Подсказка:</strong> для выбранной
            даты можно добавить несколько временных слотов записи.
          </span>
        </p>
      </div>
    </section>
  );
}
