"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { StableCardSelector } from "@/components/ui/stable-card-selector";
import { DayScheduleEditor } from "@/components/openingHours/DayScheduleEditor";
import { TimePicker } from "@/components/openingHours/TimePicker";
import { DAY_SHORT_LABELS, WEEKDAYS, WEEKEND_DAYS } from "@/components/openingHours/openingHours.types";
import type { DayOfWeek } from "@prisma/client";
import {
  DAYS_ORDER,
  hoursFromSimple,
  offerUsesOpeningHours,
  simpleFromHours,
  type OfferScheduleForm,
} from "@/lib/offers/offerSchedule";
import type { OfferFormData } from "../types";
import { ClosedDaysCalendar } from "../components/ClosedDaysCalendar";

interface StepOpeningHoursProps {
  data: OfferFormData;
  onChange: (updates: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

type DaysPreset = { id: string; label: string; days: DayOfWeek[] };

const PRESETS: DaysPreset[] = [
  { id: "all", label: "Каждый день", days: [...DAYS_ORDER] },
  { id: "weekdays", label: "Будни", days: WEEKDAYS },
  { id: "weekend", label: "Выходные", days: WEEKEND_DAYS },
];

function sameDays(a: readonly DayOfWeek[], b: readonly DayOfWeek[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

/** Блоки «Когда работаете» и «Выходные и особые дни» нового шага «Расписание». */
export function StepOpeningHours({ data, onChange, isEditable }: StepOpeningHoursProps) {
  const schedule = data.schedule;
  const showHours = offerUsesOpeningHours(data.productType);
  // Закрытые дни занятий — в блоке расписания занятий (OfferScheduleException), здесь только место и праздники.
  const showClosedDays = showHours;
  const own = schedule.hoursSource === "own";

  const simple = useMemo(() => simpleFromHours(schedule.hours), [schedule.hours]);
  // Разное время по дням включается явно, а также когда сохранённый график иначе не выразить.
  const [perDay, setPerDay] = useState(() => own && simpleFromHours(schedule.hours) === null);

  const update = (patch: Partial<OfferScheduleForm>) => onChange({ schedule: { ...schedule, ...patch } });

  const setSimple = (next: { days: DayOfWeek[]; from: string; to: string }) =>
    update({ hours: hoursFromSimple(next, schedule.hours.timezone) });

  const current = simple ?? { days: [], from: "10:00", to: "20:00" };

  const presetChips: ChipItem[] = PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    active: sameDays(current.days, preset.days),
    disabled: !isEditable,
    onClick: () => setSimple({ ...current, days: preset.days }),
  }));

  const dayChips: ChipItem[] = DAYS_ORDER.map((day) => ({
    id: day,
    label: DAY_SHORT_LABELS[day],
    active: current.days.includes(day),
    disabled: !isEditable,
    onClick: () =>
      setSimple({
        ...current,
        days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day],
      }),
  }));

  return (
    <div className="space-y-8">
      {showHours && (
        <section className="space-y-4" aria-labelledby="schedule-hours-title">
          <div>
            <h3 id="schedule-hours-title" className="text-base font-semibold">
              1. Когда работаете
            </h3>
            <p className="text-sm text-muted-foreground">Родители увидят график на карточке предложения.</p>
          </div>

          <StableCardSelector
            value={schedule.hoursSource}
            onValueChange={(hoursSource: "place" | "own") => update({ hoursSource })}
            options={[
              { value: "place" as const, label: "Как у места", description: "Берём график из карточки места" },
              { value: "own" as const, label: "Свой график", description: "Если предложение работает в другие часы" },
            ]}
            isEditable={isEditable}
            className="grid gap-3 sm:grid-cols-2"
          />

          {own && !perDay && simple && (
            <div className="space-y-4">
              <ChipsRow items={presetChips} layout="wrap" aria-label="Готовые наборы дней" />
              <ChipsRow items={dayChips} layout="wrap" aria-label="Дни работы" />
              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm">с</Label>
                <TimePicker
                  value={current.from}
                  onChange={(from) => setSimple({ ...current, from })}
                  disabled={!isEditable}
                />
                <Label className="text-sm">до</Label>
                <TimePicker
                  value={current.to}
                  onChange={(to) => setSimple({ ...current, to })}
                  disabled={!isEditable}
                />
              </div>
              <button
                type="button"
                className="text-sm text-primary underline-offset-2 hover:underline"
                onClick={() => setPerDay(true)}
                disabled={!isEditable}
              >
                В разные дни разное время
              </button>
            </div>
          )}

          {own && (perDay || !simple) && (
            <div className="space-y-3">
              {schedule.hours.rules.map((rule) => (
                <DayScheduleEditor
                  key={rule.dayOfWeek}
                  day={rule}
                  disabled={!isEditable}
                  onChange={(day) =>
                    update({
                      hours: {
                        ...schedule.hours,
                        rules: schedule.hours.rules.map((item) => (item.dayOfWeek === day.dayOfWeek ? day : item)),
                      },
                    })
                  }
                />
              ))}
              {simple && (
                <button
                  type="button"
                  className="text-sm text-primary underline-offset-2 hover:underline"
                  onClick={() => setPerDay(false)}
                  disabled={!isEditable}
                >
                  Одинаковое время во все дни
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {showClosedDays && (
        <section className="space-y-3" aria-labelledby="schedule-closed-title">
          <div>
            <h3 id="schedule-closed-title" className="text-base font-semibold">
              2. Выходные и особые дни
            </h3>
            <p className="text-sm text-muted-foreground">
              Нажмите на дату, чтобы закрыть её. Повторное нажатие снова откроет день.
            </p>
          </div>
          {!own ? (
            <p className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
              Чтобы закрывать отдельные дни, выберите «Свой график».
            </p>
          ) : (
            <ClosedDaysCalendar
              value={schedule.closedDates}
              onChange={(closedDates) => update({ closedDates })}
              disabled={!isEditable}
            />
          )}
        </section>
      )}
    </div>
  );
}
