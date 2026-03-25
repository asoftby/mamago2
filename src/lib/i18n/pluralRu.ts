/** Склонение для числительных: 1 заявка, 2 заявки, 5 заявок */
export function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
