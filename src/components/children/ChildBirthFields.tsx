"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";

export type ChildBirthDraft =
  | { precision: "DAY"; date: string }
  | { precision: "MONTH"; year: string; month: string };

const MONTHS: FilterSelectOption[] = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
].map((label, index) => ({ value: String(index + 1), label }));

const YEARS: FilterSelectOption[] = Array.from({ length: 19 }, (_, index) => {
  const year = new Date().getUTCFullYear() - index;
  return { value: String(year), label: String(year) };
});

export function emptyChildBirthDraft(): ChildBirthDraft {
  return { precision: "DAY", date: "" };
}

export function childBirthDraftFromStored(input: {
  birthDate: string | Date | null;
  birthPrecision?: "DAY" | "MONTH" | null;
}): ChildBirthDraft {
  if (!input.birthDate) return emptyChildBirthDraft();
  const date = input.birthDate instanceof Date ? input.birthDate : new Date(input.birthDate);
  if (Number.isNaN(date.getTime())) return emptyChildBirthDraft();
  const iso = date.toISOString();
  if (input.birthPrecision === "DAY") return { precision: "DAY", date: iso.slice(0, 10) };
  return {
    precision: "MONTH",
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1),
  };
}

export function childBirthDraftPayload(value: ChildBirthDraft): Record<string, unknown> | null {
  if (value.precision === "DAY") {
    return value.date ? { birthDate: value.date, birthPrecision: "DAY" } : null;
  }
  if (!value.year || !value.month) return null;
  return {
    birthPrecision: "MONTH",
    birthYear: Number(value.year),
    birthMonth: Number(value.month),
  };
}

export function ChildBirthFields({
  value,
  onChange,
  idPrefix,
}: {
  value: ChildBirthDraft;
  onChange: (value: ChildBirthDraft) => void;
  idPrefix: string;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const selected = value.precision === "DAY" && value.date ? new Date(`${value.date}T12:00:00`) : null;
  return (
    <div className="space-y-3">
      <Label htmlFor={`${idPrefix}-exact`}>Дата рождения ребёнка</Label>
      {value.precision === "DAY" ? (
        <div className="space-y-2">
          <Button type="button" variant="outline" id={`${idPrefix}-exact`} className="w-full justify-start" onClick={() => {
            setCalendarMonth(selected ?? new Date());
            setCalendarOpen((open) => !open);
          }} aria-expanded={calendarOpen}>
            {selected && !Number.isNaN(selected.getTime()) ? selected.toLocaleDateString("ru-RU") : "Выбрать дату рождения"}
          </Button>
          {calendarOpen && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <label htmlFor={`${idPrefix}-year`} className="text-sm text-neutral-600">Год</label>
                <select id={`${idPrefix}-year`} className="h-10 flex-1 rounded-lg border border-neutral-200 px-3" value={calendarMonth.getFullYear()} onChange={(event) => setCalendarMonth(new Date(Number(event.target.value), calendarMonth.getMonth(), 1))}>
                  {Array.from({ length: 19 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>
              <Calendar key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`} size="compact" disablePast={false} defaultMonth={calendarMonth} value={selected} onChange={(date) => {
                if (!date || date > new Date()) return;
                onChange({ precision: "DAY", date: formatDate(date) });
                setCalendarOpen(false);
              }} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <FilterSelect
            value={value.month}
            onChange={(month) => onChange({ ...value, month })}
            options={MONTHS}
            placeholder="Месяц"
            aria-label="Месяц рождения"
          />
          <FilterSelect
            value={value.year}
            onChange={(year) => onChange({ ...value, year })}
            options={YEARS}
            placeholder="Год"
            aria-label="Год рождения"
          />
        </div>
      )}
      {value.precision === "MONTH" && <button
        type="button"
        className="text-sm font-medium text-[#EF8759] hover:underline"
        onClick={() =>
          onChange(
            value.precision === "DAY"
              ? { precision: "MONTH", year: "", month: "" }
              : { precision: "DAY", date: "" },
          )
        }
      >
        Указать полную дату
      </button>}
    </div>
  );
}
