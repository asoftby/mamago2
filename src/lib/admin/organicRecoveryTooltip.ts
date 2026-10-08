import type { OrganicWeekPoint } from "./growthDashboardViewModel";

export type OrganicRecoveryTooltipRow = { label: string; value: string };

export function organicRecoveryTooltipRows(point: OrganicWeekPoint): OrganicRecoveryTooltipRow[] {
  const rows: OrganicRecoveryTooltipRow[] = [];
  if (point.actual !== null) {
    rows.push({ label: "Факт", value: `${point.actual.toLocaleString("ru-RU")} кликов` });
    if (point.baseline !== null && point.baseline > 0) {
      rows.push({ label: "% от базы", value: `${((point.actual / point.baseline) * 100).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%` });
    }
  }
  if (point.trajectory !== null) {
    rows.push({ label: "План", value: `${point.trajectory.toLocaleString("ru-RU")} кликов` });
    if (point.actual !== null) {
      const delta = point.actual - point.trajectory;
      rows.push({ label: "Отклонение", value: `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString("ru-RU")}` });
    }
  }
  return rows;
}
