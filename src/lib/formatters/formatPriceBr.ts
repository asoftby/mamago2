export function formatPriceBr(
  value: number | null | undefined,
  options?: { from?: boolean },
): string {
  if (value == null) return "";

  const hasDecimals = Math.round(value * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(value);

  return `${options?.from ? "от " : ""}${formatted} Br`;
}
