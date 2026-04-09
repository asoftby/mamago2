export function isoFromDate(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function dateFromIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function addDaysIso(iso: string, days: number): string {
  const dt = dateFromIso(iso);
  dt.setDate(dt.getDate() + days);
  return isoFromDate(dt);
}

export function getWeekStart(iso: string, localeStartMonday = true): string {
  const d = dateFromIso(iso);
  const dow = d.getDay();
  const normalized = localeStartMonday ? (dow === 0 ? 7 : dow) : dow;
  const diff = localeStartMonday ? 1 - normalized : -normalized;
  d.setDate(d.getDate() + diff);
  return isoFromDate(d);
}

export function getWeekDays(visibleWeekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysIso(visibleWeekStart, i));
}

export function getNextWeekStart(visibleWeekStart: string): string {
  return addDaysIso(visibleWeekStart, 7);
}

export function getPrevWeekStart(visibleWeekStart: string): string {
  return addDaysIso(visibleWeekStart, -7);
}

export function preserveWeekday(prevSelectedDate: string, nextWeekStart: string): string {
  const prevDate = dateFromIso(prevSelectedDate);
  const prevDow = prevDate.getDay() === 0 ? 7 : prevDate.getDay();
  return addDaysIso(nextWeekStart, prevDow - 1);
}

export function isSameDay(aIso: string, bIso: string): boolean {
  return aIso === bIso;
}

export function isToday(iso: string): boolean {
  return iso === isoFromDate(new Date());
}

export function buildWeekMonthLabel(weekDays: string[], selectedDate?: string): string {
  if (weekDays.length === 0) return "";
  
  // Use selected date if provided, otherwise use middle of week
  const referenceIso = selectedDate ?? weekDays[Math.floor(weekDays.length / 2)]!;
  const referenceDate = dateFromIso(referenceIso);
  
  // Simple format: "АПРЕЛЬ" or "АПРЕЛЬ 2026" (show year if not current year)
  const month = referenceDate.toLocaleDateString("ru-RU", { month: "long" }).toUpperCase();
  const year = referenceDate.getFullYear();
  const currentYear = new Date().getFullYear();
  
  // Show year only if different from current year
  if (year !== currentYear) {
    return `${month} ${year}`;
  }
  
  return month;
}
