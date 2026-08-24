import { addDateKeyDays, weekdayFromDateKey, zonedDateKey } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

/**
 * Единственный источник правды для «Сегодня / Завтра / Выходные» на чипсах
 * discovery. Чистые функции, таймзона — явный параметр (по умолчанию
 * DEFAULT_TZ = Europe/Minsk), никогда не берём её из окружения/`new Date()`
 * без zonedDateKey. Семантика WEEKEND зеркалит resolveEventDateRange()
 * (src/server/discovery/eventFilterSemantics.ts) — та же civil-date
 * арифметика (zonedDateKey/weekdayFromDateKey/addDateKeyDays), только здесь
 * в виде inclusive date-key пары {from, to} для записи в URL, а не
 * half-open DateTime диапазона для Prisma-запроса.
 */
export type QuickFilterPreset = "TODAY" | "TOMORROW" | "WEEKEND";

export type PresetDateRange = { from: string; to: string };

/** Civil YYYY-MM-DD «сегодня» в `timeZone` — единая точка перевода `now` → «сегодня». */
export function todayKeyIn(now: Date, timeZone: string = DEFAULT_TZ): string {
  return zonedDateKey(now, timeZone);
}

/**
 * Диапазон пресета относительно `todayKey` (уже вычисленного civil-date,
 * см. todayKeyIn). Крайние случаи «Выходных»:
 * - будни (Mon–Fri): ближайшие Сб–Вс;
 * - Суббота: [сегодня, завтра] — Сб+Вс;
 * - Воскресенье: [сегодня, сегодня] — только оставшийся день выходных.
 */
export function computePresetRange(preset: QuickFilterPreset, todayKey: string): PresetDateRange {
  switch (preset) {
    case "TODAY":
      return { from: todayKey, to: todayKey };
    case "TOMORROW": {
      const tomorrow = addDateKeyDays(todayKey, 1);
      return { from: tomorrow, to: tomorrow };
    }
    case "WEEKEND": {
      const weekday = weekdayFromDateKey(todayKey); // 0 = Sun, 6 = Sat
      if (weekday === 6) {
        return { from: todayKey, to: addDateKeyDays(todayKey, 1) };
      }
      if (weekday === 0) {
        return { from: todayKey, to: todayKey };
      }
      const saturday = addDateKeyDays(todayKey, 6 - weekday);
      return { from: saturday, to: addDateKeyDays(saturday, 1) };
    }
  }
}

/**
 * Вычисляемая активность чипа: какому пресету (если хоть одному) сейчас
 * соответствует пара from/to — не хранится, всегда пересчитывается из
 * текущих применённых фильтров. Если `dateTo` не задан, считается равным
 * `dateFrom` (одиночный день). Возвращает null, если ни один пресет не
 * совпал (произвольная дата/диапазон, выбранные вручную).
 */
export function matchPreset(
  dateFrom: string | null,
  dateTo: string | null,
  todayKey: string,
): QuickFilterPreset | null {
  if (!dateFrom) return null;
  const effectiveTo = dateTo ?? dateFrom;
  const presets: QuickFilterPreset[] = ["TODAY", "TOMORROW", "WEEKEND"];
  for (const preset of presets) {
    const range = computePresetRange(preset, todayKey);
    if (range.from === dateFrom && range.to === effectiveTo) {
      return preset;
    }
  }
  return null;
}
