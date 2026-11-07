// Русские форматтеры дат save-flow — вынесены из SaveToPlanModal без изменений.

export const RU_MONTHS_SHORT = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
export const RU_MONTHS_FULL  = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
export const RU_MONTHS_NAMED = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
export const RU_DAYS_SHORT   = ["вс","пн","вт","ср","чт","пт","сб"];
export const RU_DAYS_FULL    = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];

export function pluralDat(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дат";
  if (mod10 === 1) return "дата";
  if (mod10 >= 2 && mod10 <= 4) return "даты";
  return "дат";
}

export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function formatSessionDotsLabel(count: number): string {
  if (count >= 3) return "3 или больше сеансов в этот день";
  return `${count} ${pluralRu(count, ["сеанс", "сеанса", "сеансов"])} в этот день`;
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDateChip(iso: string) {
  const d = parseLocalDate(iso);
  return {
    dow: RU_DAYS_SHORT[d.getDay()],
    day: String(d.getDate()),
    month: RU_MONTHS_SHORT[d.getMonth()],
    monthIdx: d.getMonth(),
    year: d.getFullYear(),
  };
}

export function fmtDateLong(iso: string): string {
  const d = parseLocalDate(iso);
  const dow = RU_DAYS_FULL[d.getDay()];
  return `${dow.charAt(0).toUpperCase() + dow.slice(1)}, ${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}

export function fmtDateShort(iso: string): string {
  const d = parseLocalDate(iso);
  return `${d.getDate()} ${RU_MONTHS_FULL[d.getMonth()]}`;
}
