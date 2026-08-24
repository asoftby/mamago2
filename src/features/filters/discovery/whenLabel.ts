import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { type WhenPreset } from "./filters.store";
import { computePresetRange, todayKeyIn, type QuickFilterPreset } from "./quickFilterPresets";

function fmtDay(d: Date): string {
  return format(d, "d MMM", { locale: ru }); // e.g., "5 мар."
}

function dateKeyToNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

function presetRangeFromNow(preset: QuickFilterPreset, now: Date): { from: Date; to: Date } {
  const { from, to } = computePresetRange(preset, todayKeyIn(now));
  return { from: dateKeyToNoon(from), to: dateKeyToNoon(to) };
}

function fmtWeekendRange(start: Date, end: Date): string {
  // if same month: "7–8 мар."
  // if different: "30 мар. – 1 апр."
  const sameMonth = format(start, "M", { locale: ru }) === format(end, "M", { locale: ru });
  if (sameMonth) {
    return `${format(start, "d", { locale: ru })}–${format(end, "d MMM", { locale: ru })}`;
  }
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

export function whenLabel(filters: {
  whenPreset: WhenPreset;
  dateFrom: string | null;
  dateTo: string | null;
}): string {
  const dot = " • ";

  /**
   * Раньше TODAY/TOMORROW/WEEKEND здесь считались через `new Date()` +
   * `base.getDay()` в таймзоне хоста, а не Europe/Minsk — и с неверным
   * крайним случаем для воскресенья (прыгал на следующие выходные вместо
   * оставшегося дня этих). Из-за этого лейбл над пилюлей мог показывать не
   * тот диапазон, что реально уходит в выдачу через resolveEventDateRange()
   * на сервере. Теперь оба места считают от одних и тех же civil-date
   * функций (quickFilterPresets.ts), различается только формат результата.
   */
  if (filters.whenPreset === "TODAY") {
    const { from } = presetRangeFromNow("TODAY", new Date());
    return `Сегодня${dot}${fmtDay(from)}`;
  }

  if (filters.whenPreset === "TOMORROW") {
    const { from } = presetRangeFromNow("TOMORROW", new Date());
    return `Завтра${dot}${fmtDay(from)}`;
  }

  if (filters.whenPreset === "WEEKEND") {
    const { from, to } = presetRangeFromNow("WEEKEND", new Date());
    return `Эти выходные${dot}${fmtWeekendRange(from, to)}`;
  }
  
  // fallback to dateFrom/dateTo (YYYY-MM-DD strings)
  // parse safely into Date at start of day:
  if (!filters.dateFrom && !filters.dateTo) return "Выберите…";
  
  // Validate dates before parsing
  const isValidDate = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
  };
  
  if (filters.dateFrom && filters.dateTo && filters.dateFrom === filters.dateTo) {
    if (!isValidDate(filters.dateFrom)) return "Выберите…";
    return fmtDay(new Date(filters.dateFrom));
  }
  
  if (filters.dateFrom && filters.dateTo) {
    if (!isValidDate(filters.dateFrom) || !isValidDate(filters.dateTo)) return "Выберите…";
    const a = new Date(filters.dateFrom);
    const b = new Date(filters.dateTo);
    return `${fmtDay(a)} – ${fmtDay(b)}`;
  }
  
  if (filters.dateFrom) {
    if (!isValidDate(filters.dateFrom)) return "Выберите…";
    return fmtDay(new Date(filters.dateFrom));
  }
  
  return "Выберите…";
}

/** Окончание H1 должно описывать ту же дату, которой ограничен запрос. */
export function whenPresetPageTitleSuffix(filters: {
  whenPreset: WhenPreset;
  dateFrom: string | null;
  dateTo: string | null;
}): string {
  if (filters.whenPreset === "TODAY") return " сегодня";
  if (filters.whenPreset === "TOMORROW") return " завтра";
  if (filters.whenPreset === "WEEKEND") return " на выходных";
  if (filters.dateFrom) return ` — ${whenLabel(filters)}`;
  return "";
}
