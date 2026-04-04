/**
 * Возраст в полных годах на «сегодня» (как в deriveAgeRangesFromChildren).
 * Без даты / невалидная дата → +∞ (в сортировке «самый старший» в конце блока).
 */
export function ageYearsFromBirthDate(iso: string | undefined | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const b = new Date(iso);
  if (Number.isNaN(b.getTime())) return Number.POSITIVE_INFINITY;
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years -= 1;
  return years;
}
