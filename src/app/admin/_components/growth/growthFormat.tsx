/**
 * Small shared presentation helpers for the growth dashboard blocks.
 * Stays inside the existing admin palette: gray text scale, green/red
 * deltas, indigo accent for the North Star.
 */

export function fmtInt(value: number | null): string {
  return value === null ? "Нет данных" : Math.round(value).toLocaleString("ru-RU");
}

export function fmtPct(value: number | null, empty = "—"): string {
  return value === null ? empty : `${Math.round(value * 100)}%`;
}

/** Relative change in %, e.g. +12.5% — green when up, red when down. */
export function DeltaPercent({ value, suffix }: { value: number | null; suffix: string }) {
  if (value === null) return <span className="text-xs text-gray-400">нет сравнения</span>;
  const sign = value > 0 ? "+" : "";
  const tone = value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-500";
  return (
    <span className={`text-xs ${tone}`}>
      {sign}
      {value.toLocaleString("ru-RU")}% {suffix}
    </span>
  );
}

/** Change in percentage points, e.g. +1.5 п.п. */
export function DeltaPp({ value }: { value: number | null }) {
  if (value === null) return null;
  const sign = value > 0 ? "+" : "";
  const tone = value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-500";
  return (
    <span className={`text-xs ${tone}`}>
      {sign}
      {value.toLocaleString("ru-RU")} п.п.
    </span>
  );
}

/** Tiny week-by-week trend line. Hidden until there are two points to connect. */
export function Sparkline({ values, className = "text-gray-400" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const width = 96;
  const height = 24;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Тренд за ${values.length} нед.`}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
