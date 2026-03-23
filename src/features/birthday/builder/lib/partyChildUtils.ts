/** Возраст в полных годах по дате рождения */
export function ageYearsFromBirthDate(iso: string | Date): number {
  const birth = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return Math.max(0, Math.min(25, years));
}

/** Склонение «N лет / года / год» */
export function formatYearsRu(years: number): string {
  const n = Math.floor(Math.abs(years));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} года`;
  return `${n} лет`;
}

/** Приблизительная дата рождения для сохранения ребёнка по введённому возрасту (середина года) */
export function birthDateIsoFromAgeYears(ageYears: number): string {
  const y = new Date().getFullYear() - Math.min(25, Math.max(1, Math.floor(ageYears)));
  const d = new Date(y, 5, 15);
  return d.toISOString().slice(0, 10);
}
