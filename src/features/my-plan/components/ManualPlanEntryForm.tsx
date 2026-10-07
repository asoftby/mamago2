"use client";

import { useEffect, useId, useState } from "react";

export type ManualPlanEntryChildOption = { id: string; name: string };

export type ManualPlanEntryEditableItem = {
  id: string;
  entryType: "EVENT" | "ACTIVITY" | "TASK" | null;
  title: string | null;
  childId: string | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  reminderAt?: string | null;
  locationText: string | null;
  notes: string | null;
  updatedAt?: string;
};

function localDateTimeValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((entry) => entry.type === type)?.value ?? "";

  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return `${part("year")}-${part("month")}-${part("day")}T${timePart}`;
}

function timeValue(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function ManualPlanEntryForm<TItem extends ManualPlanEntryEditableItem>({
  active = true,
  date,
  familyChildren,
  item,
  defaultEntryType = "ACTIVITY",
  compact = false,
  onSaved,
  onConflict,
  onCancel,
}: {
  active?: boolean;
  date: string;
  familyChildren: ManualPlanEntryChildOption[];
  item: TItem | null;
  defaultEntryType?: "EVENT" | "ACTIVITY" | "TASK";
  compact?: boolean;
  onSaved: (item: TItem) => void | Promise<void>;
  onConflict: () => void;
  onCancel?: () => void;
}) {
  const errorId = useId();
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<"EVENT" | "ACTIVITY" | "TASK">(defaultEntryType);
  const [childId, setChildId] = useState("");
  const [entryDate, setEntryDate] = useState(date);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!active) return;
    setTitle(item?.title ?? "");
    setEntryType(item?.entryType ?? defaultEntryType);
    setChildId(item?.childId ?? "");
    setEntryDate(item?.date ?? date);
    setStartsAt(timeValue(item?.startsAt));
    setEndsAt(timeValue(item?.endsAt));
    setReminderAt(localDateTimeValue(item?.reminderAt));
    setLocationText(item?.locationText ?? "");
    setNotes(item?.notes ?? "");
    setError("");
  }, [active, date, defaultEntryType, item]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(item ? `/api/plan/manual/${item.id}` : "/api/plan/manual", {
        method: item ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          entryType,
          childId: childId || null,
          date: entryDate,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          reminderAt: reminderAt || null,
          locationText: locationText || null,
          notes: notes || null,
          ...(item ? { expectedUpdatedAt: item.updatedAt } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { item?: TItem; error?: string }
        | null;

      if (response.status === 409) {
        onConflict();
        return;
      }
      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error ?? "save_failed");
      }

      await onSaved(payload.item);
    } catch {
      setError("Не удалось сохранить. Проверьте дату и время.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelClass = "grid gap-1.5 text-sm font-medium text-neutral-800";

  return (
    <form
      onSubmit={submit}
      className={compact ? "grid gap-3" : "grid gap-4"}
    >
      <label className={labelClass}>
        Что?
        <input
          autoFocus
          required
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
          aria-describedby={error ? errorId : undefined}
        />
      </label>

      <div className={compact ? "grid grid-cols-2 gap-3" : "grid gap-4 sm:grid-cols-2"}>
        <label className={labelClass}>
          Тип
          <select
            value={entryType}
            onChange={(event) => setEntryType(event.target.value as typeof entryType)}
            className={inputClass}
          >
            <option value="EVENT">Событие</option>
            <option value="ACTIVITY">Занятие</option>
            <option value="TASK">Дело</option>
          </select>
        </label>

        <label className={labelClass}>
          Для кого?
          <select
            value={childId}
            onChange={(event) => setChildId(event.target.value)}
            className={inputClass}
          >
            <option value="">Я / Семья</option>
            {familyChildren.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        Дата
        <input
          required
          type="date"
          value={entryDate}
          onChange={(event) => setEntryDate(event.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Начало
          <input
            type="time"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Окончание
          <input
            type="time"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className={labelClass}>
        Напомнить
        <input
          type="datetime-local"
          value={reminderAt}
          onChange={(event) => setReminderAt(event.target.value)}
          className={inputClass}
        />
        <span className="text-xs font-normal text-neutral-500">
          Необязательно. mamaGo напомнит в выбранное время.
        </span>
      </label>

      <label className={labelClass}>
        Место
        <input
          maxLength={240}
          value={locationText}
          onChange={(event) => setLocationText(event.target.value)}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Заметка
        <textarea
          maxLength={2000}
          rows={compact ? 2 : 3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 flex-1 rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Сохраняем…" : item ? "Сохранить" : "Добавить"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-11 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 disabled:opacity-60"
          >
            Отмена
          </button>
        ) : null}
      </div>
    </form>
  );
}
