/**
 * Персональный порядок карточек подборки. Чистая логика без запросов: состав подборки одинаков
 * для всех, меняется только порядок по возрасту детей. Работает в браузере поверх общей
 * (кешируемой) серверной выдачи и не форкает ranking-движок рекомендаций.
 */
/** `ageMonthsMax` задан, когда точный возраст неизвестен (гость выбрал год): тогда это интервал. */
export type OrderKid = { id: string; name: string | null; ageMonths: number; ageMonthsMax?: number };
export type OrderItem = { id: string; ageMinMonths: number | null; ageMaxMonths: number | null };
export type AgeFit = "MATCH" | "UNKNOWN" | "MISMATCH";

export function ageFit(item: OrderItem, kid: number | Pick<OrderKid, "ageMonths" | "ageMonthsMax">): AgeFit {
  const lo = typeof kid === "number" ? kid : kid.ageMonths;
  const hi = typeof kid === "number" ? kid : kid.ageMonthsMax ?? kid.ageMonths;
  if (item.ageMinMonths == null && item.ageMaxMonths == null) return "UNKNOWN";
  if ((item.ageMinMonths != null && item.ageMinMonths > hi) || (item.ageMaxMonths != null && item.ageMaxMonths < lo)) return "MISMATCH";
  const covers = (item.ageMinMonths == null || item.ageMinMonths <= lo) && (item.ageMaxMonths == null || item.ageMaxMonths >= hi);
  // Частичное пересечение с интервалом возраста — не подтверждённое совпадение.
  return covers ? "MATCH" : "UNKNOWN";
}

function score(item: OrderItem, kids: readonly OrderKid[]): number {
  if (!kids.length) return 0;
  const fits = kids.map((k) => ageFit(item, k));
  const matches = fits.filter((f) => f === "MATCH").length;
  if (matches > 0) return matches * 10;
  return fits.every((f) => f === "MISMATCH") ? -1 : 0;
}

/** Устойчивая сортировка: при равных баллах сохраняется редакционный порядок. */
export function orderCollection<T extends OrderItem>(items: readonly T[], kids: readonly OrderKid[]): T[] {
  if (!kids.length) return [...items];
  return items
    .map((item, index) => ({ item, index, s: score(item, kids) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.item);
}

export function ageYears(ageMonths: number): number {
  return Math.floor(ageMonths / 12);
}

function yearsWord(n: number): string {
  const m = n % 10;
  const h = n % 100;
  return m === 1 && h !== 11 ? "год" : m >= 2 && m <= 4 && (h < 12 || h > 14) ? "года" : "лет";
}

/** Причина показывается только при реальном совпадении возраста. */
export function reasonFor(item: OrderItem, kids: readonly OrderKid[]): { kidIds: string[]; text: string } | null {
  const fit = kids.filter((k) => ageFit(item, k) === "MATCH");
  if (!fit.length) return null;
  const named = fit.every((k) => !!k.name?.trim());
  if (named) {
    if (fit.length === 1) {
      const y = ageYears(fit[0].ageMonths);
      return { kidIds: [fit[0].id], text: `Подходит: ${fit[0].name}, ${y} ${yearsWord(y)}` };
    }
    return { kidIds: fit.map((k) => k.id), text: `Подходит: ${fit.map((k) => k.name).join(" и ")}` };
  }
  const ys = fit.map((k) => ageYears(k.ageMonths));
  const last = ys[ys.length - 1];
  const kidIds = fit.map((k) => k.id);
  if (last === 0 && ys.length === 1) return { kidIds, text: "Подходит до года" };
  return { kidIds, text: `Подходит для ${ys.join(" и ")} ${last % 10 === 1 && last % 100 !== 11 ? "года" : "лет"}` };
}

export function ageMonthsFromBirthDate(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) - (now.getDate() < d.getDate() ? 1 : 0);
  return months >= 0 ? months : null;
}

/** Гость выбирает возраст в годах: это интервал [y·12, y·12+11] месяцев, а не выдуманная точка. */
export function kidsFromGuestYears(years: readonly number[]): OrderKid[] {
  return years.map((y) => ({ id: `guest-${y}`, name: null, ageMonths: y * 12, ageMonthsMax: y * 12 + 11 }));
}
