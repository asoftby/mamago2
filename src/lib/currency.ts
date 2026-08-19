export const BELARUSIAN_RUBLE_CODE = "BYN";
export const BELARUSIAN_RUBLE_NAME = "Белорусский рубль";
export const BELARUSIAN_RUBLE_SYMBOL = "\uE901";

export function isBelarusianRubleCurrency(
  value: string | null | undefined,
): boolean {
  return value?.trim().toUpperCase() === BELARUSIAN_RUBLE_CODE;
}
