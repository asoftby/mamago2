"use client";

import { useState, useEffect, useMemo } from "react";
import { EventScheduleList } from "@/components/admin/event-schedule/EventScheduleList";
import type { EventScheduleItem } from "@/components/admin/event-schedule/types";
import type { EventFormData } from "../types";
import { createDefaultScheduleItem } from "../defaults";

const DEBUG_EDITOR = process.env.NODE_ENV !== "production";

function debugScheduleStepLog(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_EDITOR) return;
  if (payload) {
    console.debug(`[EventEditorScheduleStep] ${message}`, payload);
    return;
  }
  console.debug(`[EventEditorScheduleStep] ${message}`);
}

interface Step4DateTimeProps {
  data: EventFormData;
  onChange: (updates: Partial<EventFormData>) => void;
  isEditable: boolean;
  eventId?: string;
}

export function Step4DateTime({ data, onChange, isEditable, eventId }: Step4DateTimeProps) {
  const [importedScheduleItems, setImportedScheduleItems] = useState<string[]>([]);
  const scheduleItems =
    Array.isArray(data.scheduleItems) && data.scheduleItems.length > 0
      ? data.scheduleItems
      : [createDefaultScheduleItem()];

  const handleScheduleItemsChange = (nextItems: EventScheduleItem[]) => {
    const firstItem = nextItems[0] ?? createDefaultScheduleItem();
    debugScheduleStepLog("schedule items changed", {
      itemsCount: nextItems.length,
      firstDate: firstItem.date,
      allDates: nextItems.map((item) => item.date),
    });
    onChange({
      scheduleItems: nextItems,
      scheduleMode: nextItems.length > 1 ? "multiple" : "single",
      dates: nextItems.map((item) => item.date).filter((date): date is string => Boolean(date)),
      allDay: firstItem.allDay,
      startTime: firstItem.startTime,
      endTime: firstItem.endTime,
      repeatEnabled: firstItem.recurringEnabled,
      repeatUnit: firstItem.recurrenceUnit,
      repeatUntil: firstItem.recurrenceUntil,
    });
  };

  useEffect(() => {
    if (!eventId) {
      queueMicrotask(() => {
        setImportedScheduleItems([]);
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/business/events/${eventId}/schedule-source`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { items?: string[] };
      if (!cancelled) {
        setImportedScheduleItems(Array.isArray(payload.items) ? payload.items : []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const normalizedImportedItems = useMemo(() => {
    const hasTime = (value: string) => /\b\d{1,2}:\d{2}\b/.test(value);
    const toKey = (value: string) =>
      value
        .toLowerCase()
        .replace(/\b\d{4}\s*г\.?/g, "")
        .replace(/[.,]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const byKey = new Map<string, string>();
    for (const raw of importedScheduleItems) {
      const item = raw.trim();
      if (!item) continue;
      const key = toKey(item);
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, item);
        continue;
      }
      if (hasTime(item) && !hasTime(prev)) {
        byKey.set(key, item);
      } else if (item.length > prev.length) {
        byKey.set(key, item);
      }
    }
    return Array.from(byKey.values());
  }, [importedScheduleItems]);

  const VISIBLE_LIMIT = 3;
  const [showAllImported, setShowAllImported] = useState(false);
  const visibleImportedItems = showAllImported
    ? normalizedImportedItems
    : normalizedImportedItems.slice(0, VISIBLE_LIMIT);
  const hiddenCount = normalizedImportedItems.length - VISIBLE_LIMIT;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Дата и время</h2>
        <p className="text-[12px] text-muted-foreground">
          Укажите даты проведения и расписание события
        </p>
      </div>

      {normalizedImportedItems.length > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-sky-950">Даты и время из источника</h3>
              <p className="mt-1 text-[12px] text-sky-900/70">
                Это данные, которые парсер уже нашёл в источнике. Их можно использовать как ориентир при ручной проверке.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {visibleImportedItems.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-sm text-slate-800"
              >
                {item}
              </div>
            ))}
            {hiddenCount > 0 && !showAllImported ? (
              <button
                type="button"
                onClick={() => setShowAllImported(true)}
                className="mt-1 text-[12px] font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                Показать ещё {hiddenCount}
              </button>
            ) : null}
            {showAllImported && normalizedImportedItems.length > VISIBLE_LIMIT ? (
              <button
                type="button"
                onClick={() => setShowAllImported(false)}
                className="mt-1 text-[12px] font-medium text-sky-700 hover:text-sky-900 hover:underline"
              >
                Свернуть
              </button>
            ) : null}
          </div>

        </div>
      ) : null}

      <EventScheduleList
        items={scheduleItems}
        onChange={handleScheduleItemsChange}
        disabled={!isEditable}
      />
    </div>
  );
}
