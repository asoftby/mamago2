import type { ReactNode } from "react";
import { AdminDashboardBlock } from "../AdminDashboardBlock";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";
import type { GrowthOverviewViewModel } from "@/lib/admin/growthDashboardViewModel";
import { DeltaPercent, DeltaPp, Sparkline, fmtInt, fmtPct } from "./growthFormat";

function Tile({
  label,
  value,
  delta,
  footer,
  trend,
  accent = false,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
  footer?: ReactNode;
  trend?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 flex flex-col gap-1 ${
        accent ? "border-2 border-indigo-200 bg-indigo-50/50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <span className={`text-2xl font-bold ${accent ? "text-indigo-900" : "text-gray-900"}`}>{value}</span>
        {trend}
      </div>
      {delta && <div>{delta}</div>}
      {footer && <div className="text-xs text-gray-500">{footer}</div>}
    </div>
  );
}

/**
 * The four numbers that say whether the product is growing: planning
 * families (North Star), weekly and monthly audience, and whether people
 * come back. Weekly trend lines come from MetricSample history (week-end
 * readings of the rolling metric).
 */
export function GrowthKpiTiles({ model }: { model: GrowthOverviewViewModel }) {
  const block = getDashboardBlock("growthKpis");

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          accent
          label="Семьи, которые спланировали досуг · 7 дней"
          value={fmtInt(model.wpf)}
          delta={<DeltaPercent value={model.wpfWoWPercent} suffix="к прошлой неделе" />}
          trend={<Sparkline values={model.wpfSeries} className="text-indigo-500" />}
          footer={
            model.planningPenetration === null
              ? null
              : `${fmtPct(model.planningPenetration)} недельной аудитории`
          }
        />
        <Tile
          label="Аудитория · 7 дней"
          value={fmtInt(model.wau)}
          delta={<DeltaPercent value={model.wauWoWPercent} suffix="к прошлой неделе" />}
          trend={<Sparkline values={model.wauSeries} />}
          footer={model.dau === null ? null : `Сегодня: ${fmtInt(model.dau)}`}
        />
        <Tile
          label="Аудитория · 30 дней"
          value={fmtInt(model.mau)}
          delta={<DeltaPercent value={model.mauMoMPercent} suffix="к прошлым 30 дням" />}
        />
        <Tile
          label="Новые пользователи вернулись через неделю"
          value={fmtPct(model.w1, "Нет данных")}
          delta={<DeltaPp value={model.w1DeltaPp} />}
          footer={
            <>
              Через 4 недели: {fmtPct(model.w4)} <DeltaPp value={model.w4DeltaPp} />
            </>
          }
        />
      </div>
    </AdminDashboardBlock>
  );
}
