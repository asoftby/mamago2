/**
 * Локальные белорусские форматы → строка, пригодная для parsePhoneNumber (E.164).
 * Не трогает номера других стран (нет слепой замены без паттерна BY).
 *
 * Примеры:
 * - 80291234567 → +375291234567
 * - 375291234567 → +375291234567
 * - +375 (29) 123-45-67 → +375291234567 (через извлечение цифр)
 */

export function preNormalizeBelarusLocal(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return trimmed;

  // 8 0XX … — национальный формат с ведущей «8», 11 цифр
  if (digitsOnly.length === 11 && digitsOnly.startsWith("80")) {
    return `+375${digitsOnly.slice(2)}`;
  }

  // 375XXXXXXXXX без «+»
  if (digitsOnly.length === 12 && digitsOnly.startsWith("375")) {
    return `+${digitsOnly}`;
  }

  return trimmed;
}
