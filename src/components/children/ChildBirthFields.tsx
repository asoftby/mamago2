"use client";

import { Input } from "@/components/ui/input";
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
  return (
    <div className="space-y-3">
      <Label htmlFor={`${idPrefix}-exact`}>Дата рождения ребёнка</Label>
      {value.precision === "DAY" ? (
        <Input
          id={`${idPrefix}-exact`}
          type="date"
          value={value.date}
          onChange={(event) => onChange({ precision: "DAY", date: event.target.value })}
        />
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
      <button
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
        {value.precision === "DAY" ? "Указать только месяц и год" : "Указать полную дату"}
      </button>
    </div>
  );
}
