import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { HabitViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmtPct(value: number | null): string {
  return value === null ? "Нет данных" : `${Math.round(value * 100)}%`;
}

function fmtDeltaPp(deltaPp: number | null): { text: string; positive: boolean } | null {
  if (deltaPp === null) return null;
  const sign = deltaPp > 0 ? "+" : "";
  return { text: `${sign}${deltaPp} pp`, positive: deltaPp >= 0 };
}

function Stat({ label, value, deltaPp }: { label: string; value: number | null; deltaPp: number | null }) {
  const delta = fmtDeltaPp(deltaPp);
  return (
    <div>
      <div className="text-lg font-bold text-gray-900">{fmtPct(value)}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {delta && <div className={`text-xs ${delta.positive ? "text-green-600" : "text-red-600"}`}>{delta.text}</div>}
    </div>
  );
}

export function HabitBlock({ model }: { model: HabitViewModel }) {
  const block = getDashboardBlock("habit");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="W1 Retention" value={model.w1} deltaPp={model.w1DeltaPp} />
        <Stat label="W4 Retention" value={model.w4} deltaPp={model.w4DeltaPp} />
        <Stat label="3/4 Week Habit" value={model.habit3of4} deltaPp={model.habit3of4DeltaPp} />
      </div>
    </AdminDashboardBlock>
  );
}
