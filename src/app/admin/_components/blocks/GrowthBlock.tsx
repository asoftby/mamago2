import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { GrowthViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function DeltaValue({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-lg font-bold text-gray-400">Нет данных</span>;
  const sign = percent > 0 ? "+" : "";
  return (
    <span className={`text-lg font-bold ${percent >= 0 ? "text-green-600" : "text-red-600"}`}>
      {sign}
      {percent}%
    </span>
  );
}

/**
 * Organic/Direct acquisition-source growth is intentionally absent — no
 * first-party UTM/referrer capture exists yet, and GA4/Yandex reconciliation
 * (the other possible source) hasn't shipped. See docs/engineering/backlog.md.
 */
export function GrowthBlock({ model }: { model: GrowthViewModel }) {
  const block = getDashboardBlock("growth");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <DeltaValue percent={model.mauGrowthPercent} />
          <div className="text-xs text-gray-500 mt-1">MAU / 30д</div>
        </div>
        <div>
          <DeltaValue percent={model.wauGrowthPercent} />
          <div className="text-xs text-gray-500 mt-1">WAU / 7д</div>
        </div>
        <div>
          <DeltaValue percent={model.wpfGrowthPercent} />
          <div className="text-xs text-gray-500 mt-1">WPF / 7д</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        Organic / Direct: нет проверенных данных (ожидает подключения источника привлечения)
      </div>
    </AdminDashboardBlock>
  );
}
