import { format, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { WhenPreset } from "./filters.store";

function fmtDay(d: Date): string {
  return format(d, "d MMM", { locale: ru }); // e.g., "5 мар."
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

function computeWeekendRange(base: Date): { sat: Date; sun: Date } {
  // Weekend = Sat/Sun of текущей недели:
  // day: 0 Sun .. 6 Sat
  const day = base.getDay();
  // find next Saturday (including today if Saturday)
  const daysToSat = day === 0 ? 6 : (6 - day);
  const sat = addDays(base, daysToSat);
  const sun = addDays(sat, 1);
  return { sat, sun };
}

export function whenLabel(filters: {
  whenPreset: WhenPreset;
  dateFrom: string | null;
  dateTo: string | null;
}): string {
  const dot = " • ";
  
  if (filters.whenPreset === "TODAY") {
    const d = new Date();
    return `Сегодня${dot}${fmtDay(d)}`;
  }
  
  if (filters.whenPreset === "TOMORROW") {
    const d = addDays(new Date(), 1);
    return `Завтра${dot}${fmtDay(d)}`;
  }
  
  if (filters.whenPreset === "WEEKEND") {
    const { sat, sun } = computeWeekendRange(new Date());
    return `Эти выходные${dot}${fmtWeekendRange(sat, sun)}`;
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
