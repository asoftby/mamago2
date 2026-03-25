/** Форматирование значений для publication.stats (RU-локаль где уместно). */

export function formatStatValue(
  value: string | number | null | undefined,
  empty = "—"
): string {
  if (value === null || value === undefined || value === "") return empty;
  return String(value);
}

export function formatPercent(
  ratio: number | null | undefined,
  fractionDigits = 2,
  empty = "—"
): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return empty;
  return `${(ratio * 100).toFixed(fractionDigits).replace(/\.?0+$/, "")}%`;
}

export function formatNumber(
  n: number | null | undefined,
  empty = "—"
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return empty;
  return n.toLocaleString("ru-RU");
}

export function formatSeconds(
  sec: number | null | undefined,
  empty = "—"
): string {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return empty;
  return `${sec} с`;
}
