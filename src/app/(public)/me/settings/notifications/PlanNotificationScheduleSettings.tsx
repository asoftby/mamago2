"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import {
  getPlanReminderOffsetOptions,
  resolveBrowserTimeZone,
} from "@/lib/notifications/planNotificationScheduleUi";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type ScheduleData = {
  timeZone: string;
  timeZoneMode: "AUTO" | "MANUAL";
  planEveningEnabled: boolean;
  planEveningTime: string;
  planEveningNextRunAt: string;
  planReminderEnabled: boolean;
  planReminderOffsetMinutes: number;
  canUseFiveMinuteReminder: boolean;
};

function detectBrowserTimeZone(): string | null {
  try {
    return resolveBrowserTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  } catch {
    return null;
  }
}

function formatOffsetLabel(minutes: number): string {
  if (minutes === 5) return "5 минут · тест";
  if (minutes === 30) return "30 минут";
  if (minutes === 60) return "1 час";
  if (minutes === 120) return "2 часа";
  if (minutes === 180) return "3 часа";
  return `${minutes} минут`;
}

export function PlanNotificationScheduleSettings() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const autoSyncedRef = useRef(false);

  const browserTimeZone = useMemo(() => detectBrowserTimeZone(), []);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/notifications/schedule", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Не удалось загрузить расписание");
      setSchedule((await response.json()) as ScheduleData);
    } catch (error) {
      setLoadFailed(true);
      toast.error(
        error instanceof Error ? error.message : "Не удалось загрузить расписание",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<ScheduleData>) => {
      if (!schedule) return;
      const previous = schedule;
      setSchedule({ ...schedule, ...patch });
      setSaving(true);
      try {
        const response = await fetch("/api/notifications/schedule", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = (await response.json().catch(() => null)) as
          | (ScheduleData & { message?: string })
          | null;
        if (!response.ok || !json) {
          throw new Error(json?.message ?? "Не удалось сохранить расписание");
        }
        setSchedule(json);
      } catch (error) {
        setSchedule(previous);
        toast.error(
          error instanceof Error ? error.message : "Не удалось сохранить расписание",
        );
      } finally {
        setSaving(false);
      }
    },
    [schedule],
  );

  useEffect(() => {
    if (
      autoSyncedRef.current ||
      !schedule ||
      schedule.timeZoneMode !== "AUTO" ||
      !browserTimeZone ||
      browserTimeZone === schedule.timeZone
    ) {
      return;
    }
    autoSyncedRef.current = true;
    void save({ timeZone: browserTimeZone, timeZoneMode: "AUTO" });
  }, [browserTimeZone, save, schedule]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Загружаем расписание…
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-3 py-3 sm:px-4">
        <p className="text-xs font-medium text-neutral-700">
          {loadFailed ? "Не удалось загрузить настройки" : "Настройки недоступны"}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
        >
          Повторить
        </button>
      </div>
    );
  }

  const reminderOffsets = getPlanReminderOffsetOptions(
    schedule.canUseFiveMinuteReminder,
  );

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-neutral-50 p-3 md:px-0 md:py-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_88px_88px_88px] md:items-center">
        <div className="md:pl-4">
          <p className="text-xs font-semibold text-neutral-800">Вечером накануне</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Одна сводка обо всём плане на завтра
          </p>
        </div>
        <div className="flex items-center gap-2 md:col-span-3 md:grid md:grid-cols-[88px_88px_88px]">
          <input
            type="time"
            value={schedule.planEveningTime}
            disabled={!schedule.planEveningEnabled || saving}
            onChange={(event) => void save({ planEveningTime: event.target.value })}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-800 outline-none focus:border-neutral-400 disabled:opacity-50 md:col-span-2 md:w-full"
            aria-label="Время вечернего уведомления"
          />
          <div className="md:flex md:justify-center">
            <Toggle
              accent="green"
              checked={schedule.planEveningEnabled}
              onChange={(value) => void save({ planEveningEnabled: value })}
              disabled={saving}
              aria-label="Вечером накануне"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200/70 pt-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_88px_88px_88px] md:items-center">
          <div className="md:pl-4">
            <p className="text-xs font-semibold text-neutral-800">Перед событием</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Напомнить незадолго до начала
            </p>
          </div>
          <div className="flex items-center gap-2 md:col-span-3 md:grid md:grid-cols-[88px_88px_88px]">
            <select
              value={schedule.planReminderOffsetMinutes}
              disabled={!schedule.planReminderEnabled || saving}
              onChange={(event) =>
                void save({ planReminderOffsetMinutes: Number(event.target.value) })
              }
              className={cn(
                "h-9 min-w-0 rounded-xl border border-neutral-200 bg-white py-0 pl-3 pr-9 text-xs text-neutral-800 outline-none focus:border-neutral-400 md:col-span-2 md:w-full",
                !schedule.planReminderEnabled && "opacity-50",
              )}
              aria-label="За сколько напоминать о событии"
            >
              {reminderOffsets.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatOffsetLabel(minutes)}
                </option>
              ))}
            </select>
            <div className="md:flex md:justify-center">
              <Toggle
                accent="green"
                checked={schedule.planReminderEnabled}
                onChange={(value) => void save({ planReminderEnabled: value })}
                disabled={saving}
                aria-label="Напоминание перед событием"
              />
            </div>
          </div>
        </div>
        {schedule.canUseFiveMinuteReminder ? (
          <p className="mt-2 text-[11px] leading-5 text-neutral-400 md:px-4">
            «5 минут · тест» доступно только администратору и использует реальные
            данные и обычный канал доставки.
          </p>
        ) : null}
      </div>

    </div>
  );
}
