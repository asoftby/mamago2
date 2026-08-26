"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
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

const COMMON_TIME_ZONES = [
  "Europe/Minsk",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Vilnius",
  "Europe/Riga",
  "Europe/Tallinn",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/London",
  "Europe/Kyiv",
  "Europe/Moscow",
  "Asia/Tbilisi",
  "Asia/Dubai",
] as const;

function detectBrowserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
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
  const autoSyncedRef = useRef(false);

  const browserTimeZone = useMemo(() => detectBrowserTimeZone(), []);
  const timeZoneOptions = useMemo(() => {
    const values = new Set<string>(COMMON_TIME_ZONES);
    if (browserTimeZone) values.add(browserTimeZone);
    if (schedule?.timeZone) values.add(schedule.timeZone);
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [browserTimeZone, schedule?.timeZone]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications/schedule", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Не удалось загрузить расписание");
      setSchedule((await response.json()) as ScheduleData);
    } catch (error) {
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

  if (!schedule) return null;

  const reminderOffsets = schedule.canUseFiveMinuteReminder
    ? [5, 30, 60, 120, 180]
    : [30, 60, 120, 180];

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-neutral-50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-neutral-800">Вечером накануне</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Одна сводка обо всём плане на завтра
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={schedule.planEveningTime}
            disabled={!schedule.planEveningEnabled || saving}
            onChange={(event) => void save({ planEveningTime: event.target.value })}
            className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-800 outline-none focus:border-neutral-400 disabled:opacity-50"
            aria-label="Время вечернего уведомления"
          />
          <Toggle
            checked={schedule.planEveningEnabled}
            onChange={(value) => void save({ planEveningEnabled: value })}
            disabled={saving}
            aria-label="Вечером накануне"
          />
        </div>
      </div>

      <div className="border-t border-neutral-200/70 pt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-neutral-800">Перед событием</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Напомнить незадолго до начала
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={schedule.planReminderOffsetMinutes}
              disabled={!schedule.planReminderEnabled || saving}
              onChange={(event) =>
                void save({ planReminderOffsetMinutes: Number(event.target.value) })
              }
              className={cn(
                "h-9 rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-800 outline-none focus:border-neutral-400",
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
            <Toggle
              checked={schedule.planReminderEnabled}
              onChange={(value) => void save({ planReminderEnabled: value })}
              disabled={saving}
              aria-label="Напоминание перед событием"
            />
          </div>
        </div>
        {schedule.canUseFiveMinuteReminder ? (
          <p className="mt-2 text-[11px] leading-5 text-neutral-400">
            «5 минут · тест» доступно только администратору и использует реальные
            данные и обычный канал доставки.
          </p>
        ) : null}
      </div>

      <div className="border-t border-neutral-200/70 pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-neutral-800">Часовой пояс</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Уведомления приходят по вашему локальному времени
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={schedule.timeZoneMode}
              disabled={saving}
              onChange={(event) => {
                const mode = event.target.value as "AUTO" | "MANUAL";
                if (mode === "AUTO" && browserTimeZone) {
                  void save({ timeZoneMode: mode, timeZone: browserTimeZone });
                } else {
                  void save({ timeZoneMode: mode });
                }
              }}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-800 outline-none focus:border-neutral-400"
            >
              <option value="AUTO">Автоматически</option>
              <option value="MANUAL">Вручную</option>
            </select>
            {schedule.timeZoneMode === "MANUAL" ? (
              <select
                value={schedule.timeZone}
                disabled={saving}
                onChange={(event) => void save({ timeZone: event.target.value })}
                className="h-9 max-w-[220px] rounded-xl border border-neutral-200 bg-white px-2 text-xs text-neutral-800 outline-none focus:border-neutral-400"
                aria-label="Часовой пояс"
              >
                {timeZoneOptions.map((timeZone) => (
                  <option key={timeZone} value={timeZone}>
                    {timeZone}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-neutral-500">{schedule.timeZone}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
