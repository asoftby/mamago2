/**
 * Подсказки расписания из нормализованного импорта события (без server-only зависимостей).
 */

import { parseRussianDayMonthTimeToIsoMinsk } from "@/lib/dates/parseRussianDayMonthTimeMinsk";

export type EventImportScheduleHint = {
  /** Несколько дат/времён или многострочный scheduleText */
  isMultiOccurrence: boolean;
  occurrenceLines: string[];
  scheduleText: string | null;
  /** ISO первой распознанной строки (если есть) */
  firstStartAtIso?: string;
};

function splitScheduleLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseEventImportScheduleHint(raw: unknown): EventImportScheduleHint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.entityType !== "EVENT") return null;

  const scheduleText = typeof o.scheduleText === "string" ? o.scheduleText.trim() : "";

  const fromOcc = Array.isArray(o.occurrenceLines)
    ? o.occurrenceLines.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];

  const fromText = scheduleText ? splitScheduleLines(scheduleText) : [];
  const occurrenceLines = fromOcc.length > 0 ? fromOcc : fromText;

  const occs = o.occurrences;
  const multiFromStructured =
    Array.isArray(occs) && occs.length > 1;

  const isMultiOccurrence =
    occurrenceLines.length > 1 || multiFromStructured;

  if (!scheduleText && occurrenceLines.length === 0 && typeof o.startAt !== "string") {
    return null;
  }

  let firstStartAtIso: string | undefined;
  if (typeof o.startAt === "string" && o.startAt.trim()) {
    const d = new Date(o.startAt.trim());
    if (!Number.isNaN(d.getTime())) firstStartAtIso = d.toISOString();
  }
  if (!firstStartAtIso && occurrenceLines.length > 0) {
    const iso = parseRussianDayMonthTimeToIsoMinsk(occurrenceLines[0]);
    if (iso) firstStartAtIso = iso;
  }

  return {
    isMultiOccurrence,
    occurrenceLines,
    scheduleText: scheduleText || null,
    ...(firstStartAtIso ? { firstStartAtIso } : {}),
  };
}
