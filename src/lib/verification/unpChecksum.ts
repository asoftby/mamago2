/**
 * Валидация контрольной суммы УНП (Беларусь).
 * Алгоритм: взвешенная сумма первых 8 цифр (веса — простые числа 29..3),
 * остаток от деления на 11 — контрольная цифра (9-я позиция).
 * Источник: приказ МНС РБ о структуре УНП; веса подтверждены на реальном
 * примере из ГРП (691868900 -> checksum 0).
 * Буквенные серии УНП (индивидуальные предприниматели/иностранные организации)
 * не поддерживаются — приём УНП в проекте уже ограничен `/^[0-9]{9}$/`
 * (см. src/app/business/onboarding/actions.ts).
 */
const UNP_CHECKSUM_WEIGHTS = [29, 23, 19, 17, 13, 7, 5, 3] as const;

export function isValidUnpChecksum(unp: string): boolean {
  if (!/^\d{9}$/.test(unp)) {
    return false;
  }

  const digits = unp.split("").map(Number);
  const sum = UNP_CHECKSUM_WEIGHTS.reduce(
    (acc, weight, index) => acc + digits[index] * weight,
    0,
  );
  const checkDigit = sum % 11;

  // По регламенту УНП с остатком 10 не выдаются — считаем невалидным.
  if (checkDigit === 10) {
    return false;
  }

  return checkDigit === digits[8];
}
