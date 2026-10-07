"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SerializedPlanItem } from "./PlanPageClient";

type ChildOption = { id: string; name: string };

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  familyChildren: ChildOption[];
  item: SerializedPlanItem | null;
  onSaved: (item: SerializedPlanItem) => void;
  onConflict: () => void;
}) {
  const [title, setTitle] = useState("");
  const [childId, setChildId] = useState("");
  const [entryDate, setEntryDate] = useState(date);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(item?.title ?? "");
    setChildId(item?.childId ?? "");
    setEntryDate(item?.date ?? date);
    setStartsAt(timeValue(item?.startsAt ?? null));
    setEndsAt(timeValue(item?.endsAt ?? null));
    setLocationText(item?.locationText ?? "");
    setNotes(item?.notes ?? "");
    setError("");
  }, [date, item, open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(item ? `/api/plan/manual/${item.id}` : "/api/plan/manual", {
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
          ...(item ? { expectedUpdatedAt: item.updatedAt } : {}),
        }),
      });
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
          <DialogTitle>{item ? "Изменить заметку" : "Добавить в план"}</DialogTitle>
          <DialogDescription>Запишите то, что нужно сделать или не забыть</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 px-5 pb-5 pt-4">
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
          <label className={labelClass}>
            Дата
            <input required type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={inputClass} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Начало
              <input type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              Окончание
              <input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
            </label>
          </div>
          <label className={labelClass}>
            Место
            <input maxLength={240} value={locationText} onChange={(e) => setLocationText(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            Заметка
            <textarea maxLength={2000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </label>
          {error ? <p id="manual-entry-error" role="alert" className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-60">
            {saving ? "Сохраняем…" : item ? "Сохранить" : "Добавить"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
