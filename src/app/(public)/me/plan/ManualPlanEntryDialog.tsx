"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SerializedPlanItem } from "./PlanPageClient";
import { todayKey } from "@/lib/date/dateKey";

type ChildOption = { id: string; name: string };
type SeriesRule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  weekdays: number[];
  untilDate: string | null;
  maxOccurrences: number | null;
};
type SeriesSnapshot = {
  expectedUpdatedAt: string;
  expectedSeriesVersion: number;
  cutoff: string;
  title: string;
  startTime: string | null;
  childId: string | null;
  assigneeUserId: string | null;
  reminderEnabled: boolean;
  reminderLeadMinutes: number | null;
  recurrence: SeriesRule;
};
const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function timeValue(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function ManualPlanEntryDialog({
  open,
  onOpenChange,
  date,
  familyChildren,
  item,
  onSaved,
  onConflict,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  familyChildren: ChildOption[];
  item: SerializedPlanItem | null;
  onSaved: (item: SerializedPlanItem) => void;
  onConflict: () => void;
  currentUserId?: string;
}) {
  const [title, setTitle] = useState("");
  const [childId, setChildId] = useState("");
  const [entryDate, setEntryDate] = useState(date);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<"THIS" | "FUTURE">("THIS");
  const [series, setSeries] = useState<SeriesSnapshot | null>(null);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [frequency, setFrequency] = useState<SeriesRule["frequency"]>("WEEKLY");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [repeatUntil, setRepeatUntil] = useState("");
  const [repeatCount, setRepeatCount] = useState("");
  const isSeriesOwner = Boolean(item?.recurrenceSeriesId && item.date >= todayKey() && (!item.authorId || item.authorId === currentUserId));
  const editFollowing = scope === "FUTURE" && isSeriesOwner;
  const weekdayOf = (dateKey: string) => new Date(dateKey + "T00:00:00.000Z").getUTCDay() || 7;


  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setChildId(item?.childId ?? "");
    setEntryDate(item?.date ?? date);
    setStartsAt(timeValue(item?.startsAt ?? null));
    setEndsAt(timeValue(item?.endsAt ?? null));
    setLocationText(item?.locationText ?? "");
    setNotes(item?.notes ?? "");
    setTagsText((item?.tags ?? []).join(", "));
    setReminderEnabled(item?.reminderEnabled === true);
    setError("");
    setScope("THIS");
    setSeries(null);
  }, [date, item, open]);

  useEffect(() => {
    if (!open || scope !== "FUTURE" || !isSeriesOwner || !item) return;
    let active = true;
    setLoadingSeries(true);
    setError("");
    fetch(`/api/plan/manual/recurring/occurrence/${encodeURIComponent(item.id)}`, { credentials: "include" })
      .then(async response => {
        if (!response.ok) throw new Error("series_unavailable");
        return response.json() as Promise<{ series: SeriesSnapshot }>;
      })
      .then(data => {
        if (!active) return;
        const s = data.series;
        setSeries(s);
        setTitle(s.title);
        setStartsAt(s.startTime ?? "");
        setChildId(s.childId ?? "");
        setReminderEnabled(s.reminderEnabled);
        setFrequency(s.recurrence.frequency);
        setWeekdays(s.recurrence.weekdays);
        setRepeatUntil(s.recurrence.untilDate ?? "");
        setRepeatCount(s.recurrence.maxOccurrences ? String(s.recurrence.maxOccurrences) : "");
      })
      .catch(() => { if (active) setError("Не удалось загрузить настройки серии. Обновите календарь."); })
      .finally(() => { if (active) setLoadingSeries(false); });
    return () => { active = false; };
  }, [open, scope, isSeriesOwner, item]);

  const recurrenceValid = !editFollowing || Boolean(series && (
    frequency !== "WEEKLY" || weekdays.length > 0
  ) && (!repeatUntil || repeatUntil >= series.cutoff) &&
    (!repeatCount || (/^[0-9]+$/.test(repeatCount) && Number(repeatCount) >= 1 && Number(repeatCount) <= 10000)));


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editFollowing) {
        if (!series || !recurrenceValid || loadingSeries) {
          setError("Проверьте настройки повторений.");
          return;
        }
        const response = await fetch(
          `/api/plan/manual/recurring/occurrence/${encodeURIComponent(item!.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              expectedUpdatedAt: series.expectedUpdatedAt,
              expectedSeriesVersion: series.expectedSeriesVersion,
              title,
              startTime: startsAt || null,
              reminderEnabled: reminderEnabled && Boolean(startsAt),
              reminderLeadMinutes: reminderEnabled && startsAt ? series.reminderLeadMinutes : null,
              childId: childId || null,
              assigneeUserId: childId ? null : series.assigneeUserId,
              recurrence: {
                frequency,
                interval: series.recurrence.interval,
                weekdays: frequency === "WEEKLY" ? weekdays : [],
                untilDate: repeatUntil || null,
                maxOccurrences: repeatCount ? Number(repeatCount) : null,
              },
            }),
          },
        );
        if (response.status === 409) {
          onConflict();
          return;
        }
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error || "save_failed");
        }
        onOpenChange(false);
        // A future edit changes multiple weeks and the recurrence IDs.
        window.location.reload();
        return;
      }
      const response = await fetch(
        item ? `/api/plan/${item.source === "TELEGRAM_FORWARD" ? "telegram" : "manual"}/${item.id}` : "/api/plan/manual",
        {
          method: item ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            childId: childId || null,
            date: entryDate,
            startsAt: startsAt || null,
            endsAt: endsAt || null,
            locationText: locationText || null,
            notes: notes || null,
            tags: tagsText
              .split(",")
              .map((tag) => tag.trim().replace(/^#+/, "").trim())
              .filter(Boolean),
            reminderEnabled: reminderEnabled && Boolean(startsAt),
            ...(item ? { expectedUpdatedAt: item.updatedAt } : {}),
          }),
        },
      );
      const payload = await response.json() as { item?: SerializedPlanItem; error?: string };
      if (response.status === 409) {
        onConflict();
        return;
      }
      if (!response.ok || !payload.item) throw new Error(payload.error ?? "save_failed");
      onSaved(payload.item);
      onOpenChange(false);
    } catch {
      setError("Не удалось сохранить. Проверьте дату и время.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelClass = "grid gap-1.5 text-sm font-medium text-neutral-800";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto rounded-2xl p-0 sm:w-full">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>{item ? "Изменить запись" : "Добавить в план"}</DialogTitle>
          <DialogDescription>Запишите то, что нужно сделать или не забыть</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 px-5 pb-5 pt-4">
          {isSeriesOwner && (
            <fieldset className="grid gap-2 rounded-xl bg-neutral-50 p-3">
              <legend className="px-1 text-sm font-semibold">К каким делам применить изменения?</legend>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="recurrence-edit-scope" checked={scope === "THIS"}
                  onChange={() => setScope("THIS")} />
                Только это дело
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="recurrence-edit-scope" checked={scope === "FUTURE"}
                  onChange={() => setScope("FUTURE")} />
                Это и следующие
              </label>
            </fieldset>
          )}
          {loadingSeries && <p role="status" className="text-sm text-neutral-500">Загрузка расписания…</p>}
          {editFollowing && (
            <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
              Изменятся будущие повторения начиная с {series?.cutoff ?? item?.date}. Прошедшие дела останутся прежними.
              Индивидуальные изменения будущих дел будут заменены новым расписанием.
            </p>
          )}
          <label className={labelClass}>
            Что?
            <input autoFocus required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} aria-describedby={error ? "manual-entry-error" : undefined} />
          </label>
          <label className={labelClass}>
            Для кого?
            <select value={childId} onChange={(e) => setChildId(e.target.value)} className={inputClass}>
              <option value="">Я / Семья</option>
              {familyChildren.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
            </select>
          </label>
          {!editFollowing && <label className={labelClass}>
            Дата
            <input required type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
          </label>}
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Начало
              <input type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </label>
            {!editFollowing && <label className={labelClass}>
              Окончание
              <input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
            </label>}
          </div>
          {!editFollowing && <label className={labelClass}>
            Место
            <input maxLength={240} value={locationText} onChange={(e) => setLocationText(e.target.value)} className={inputClass} />
          </label>}
          {!editFollowing && <label className={labelClass}>
            Заметка
            <textarea maxLength={2000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </label>}
          {!editFollowing && <label className={labelClass}>
            Теги
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="школа, Тая"
              className={inputClass}
            />
          </label>}
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              checked={reminderEnabled}
              disabled={!startsAt}
              onChange={(e) => setReminderEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Напомнить по моим настройкам уведомлений
          </label>
          {editFollowing && (
            <fieldset className="grid gap-3 rounded-xl border border-neutral-200 p-3">
              <legend className="text-sm font-semibold">Новое расписание</legend>
              <label className={labelClass}>
                Повторять
                <select value={frequency} onChange={e => setFrequency(e.target.value as SeriesRule["frequency"])} className={inputClass}>
                  <option value="DAILY">Каждый день</option>
                  <option value="WEEKLY">Каждую неделю</option>
                  <option value="MONTHLY">Каждый месяц</option>
                </select>
              </label>
              {frequency === "WEEKLY" && (
                <div className="flex flex-wrap gap-2" aria-label="Дни недели">
                  {WEEKDAY_LABELS.map((name, index) => (
                    <button key={name} type="button" aria-pressed={weekdays.includes(index + 1)}
                      onClick={() => setWeekdays(prev => prev.includes(index + 1)
                        ? prev.filter(n => n !== index + 1) : [...prev, index + 1].sort())}
                      className={`min-h-11 min-w-11 rounded-full border px-2 text-sm ${weekdays.includes(index + 1)
                        ? "border-primary bg-primary text-white" : "border-neutral-300 bg-white"}`}>{name}</button>
                  ))}
                </div>
              )}
              <label className={labelClass}>
                Повторять до (необязательно)
                <input type="date" min={series?.cutoff} value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)}
                  className={inputClass} />
              </label>
              <label className={labelClass}>
                Количество повторений с выбранной даты (необязательно)
                <input type="number" min={1} max={10000} value={repeatCount} onChange={e => setRepeatCount(e.target.value)}
                  className={inputClass} />
              </label>
            </fieldset>
          )}
          {error ? <p id="manual-entry-error" role="alert" className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving || loadingSeries || !recurrenceValid} className="min-h-11 rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-60">
            {saving ? "Сохраняем…" : item ? "Сохранить" : "Добавить"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
