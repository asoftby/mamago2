"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/openingHours/TimePicker";
import {
  emptyClassDate,
  emptyClassGroup,
  parseClassDurationMinutes,
  type ClassDateSession,
  type ClassScheduleForm,
  type ClassSessionGroup,
} from "@/lib/offers/offerClassSchedule";
import type { OfferFormData } from "../types";
import { ClosedDaysCalendar } from "../components/ClosedDaysCalendar";

interface StepClassScheduleProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

const WEEKDAYS: Array<{ iso: number; label: string }> = [
  { iso: 1, label: "Пн" },
  { iso: 2, label: "Вт" },
  { iso: 3, label: "Ср" },
  { iso: 4, label: "Чт" },
  { iso: 5, label: "Пт" },
  { iso: 6, label: "Сб" },
  { iso: 7, label: "Вс" },
];

function keyToDate(key: string): Date | null {
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function dateToKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Блоки «Когда проходят занятия» и «Выходные и особые дни» для занятий. */
export function StepClassSchedule({ data, onChange, isEditable }: StepClassScheduleProps) {
  const schedule = data.schedule;
  const classSchedule = schedule.classSchedule;
  const regular = data.productType === "REGULAR_ACTIVITY";
  const duration = parseClassDurationMinutes(data.classDuration);

  const update = (patch: Partial<ClassScheduleForm>) =>
    onChange({ schedule: { ...schedule, classSchedule: { ...classSchedule, ...patch } } });

  const patchGroup = (id: string, patch: Partial<ClassSessionGroup>) =>
    update({ groups: classSchedule.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)) });

  const patchDate = (id: string, patch: Partial<ClassDateSession>) =>
    update({ dates: classSchedule.dates.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-labelledby="class-schedule-title">
        <div>
          <h3 id="class-schedule-title" className="text-base font-semibold">
            1. {regular ? "Когда проходят занятия" : "Даты занятий"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {regular
              ? "Добавьте группу: дни недели, время начала и число мест. Групп может быть несколько."
              : "Добавьте даты и время начала. Мест можно не указывать."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {duration
              ? `Длительность занятия: ${duration} мин (из поля «Продолжительность занятия» выше).`
              : "Укажите продолжительность занятия числом в поле выше, например «60 минут»."}
          </p>
        </div>

        {regular ? (
          <div className="space-y-4">
            {classSchedule.groups.map((group, index) => {
              const dayChips: ChipItem[] = WEEKDAYS.map((day) => ({
                id: String(day.iso),
                label: day.label,
                active: group.days.includes(day.iso),
                disabled: !isEditable,
                onClick: () =>
                  patchGroup(group.id, {
                    days: group.days.includes(day.iso)
                      ? group.days.filter((item) => item !== day.iso)
                      : [...group.days, day.iso].sort(),
                  }),
              }));
              return (
                <div key={group.id} className="space-y-3 rounded-2xl border border-border/70 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Группа {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={!isEditable}
                      onClick={() => update({ groups: classSchedule.groups.filter((item) => item.id !== group.id) })}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                  <ChipsRow items={dayChips} layout="wrap" aria-label={`Дни занятий, группа ${index + 1}`} />
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                      <Label>Начало</Label>
                      <TimePicker
                        value={group.time}
                        onChange={(time) => patchGroup(group.id, { time })}
                        disabled={!isEditable}
                      />
                    </div>
                    <div className="w-32 space-y-2">
                      <Label htmlFor={`class-seats-${group.id}`}>Мест</Label>
                      <Input
                        id={`class-seats-${group.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="8"
                        value={group.seats}
                        onChange={(event) => patchGroup(group.id, { seats: event.target.value })}
                        disabled={!isEditable}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-dashed"
              disabled={!isEditable}
              onClick={() => update({ groups: [...classSchedule.groups, emptyClassGroup()] })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить группу
            </Button>

            <div className="space-y-2">
              <Label htmlFor="class-period">Курс с началом и концом (необязательно)</Label>
              <DateRangeField
                id="class-period"
                from={classSchedule.periodFrom}
                to={classSchedule.periodTo}
                placeholder="Даты курса"
                disabled={!isEditable}
                onChange={({ from, to }) => update({ periodFrom: from, periodTo: to })}
              />
              <p className="text-sm text-muted-foreground">
                Если занятия идут без конца, оставьте поле пустым.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {classSchedule.dates.map((item, index) => (
              <div key={item.id} className="space-y-3 rounded-2xl border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Занятие {index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={!isEditable}
                    onClick={() => update({ dates: classSchedule.dates.filter((date) => date.id !== item.id) })}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px] flex-1 space-y-2">
                    <Label>Дата</Label>
                    <DatePicker
                      value={keyToDate(item.date)}
                      onDateChange={(date) => patchDate(item.id, { date: date ? dateToKey(date) : "" })}
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Начало</Label>
                    <TimePicker
                      value={item.time}
                      onChange={(time) => patchDate(item.id, { time })}
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label htmlFor={`class-date-seats-${item.id}`}>Мест</Label>
                    <Input
                      id={`class-date-seats-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="10"
                      value={item.seats}
                      onChange={(event) => patchDate(item.id, { seats: event.target.value })}
                      disabled={!isEditable}
                      className="rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-dashed"
              disabled={!isEditable}
              onClick={() => update({ dates: [...classSchedule.dates, emptyClassDate()] })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить дату
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="class-closed-title">
        <div>
          <h3 id="class-closed-title" className="text-base font-semibold">
            2. Выходные и особые дни
          </h3>
          <p className="text-sm text-muted-foreground">
            В закрытые даты занятий не будет. Нажмите на дату, чтобы закрыть её; повторное нажатие откроет день.
          </p>
        </div>
        <ClosedDaysCalendar
          value={schedule.closedDates}
          onChange={(closedDates) => onChange({ schedule: { ...schedule, closedDates } })}
          disabled={!isEditable}
        />
      </section>
    </div>
  );
}
