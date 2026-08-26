import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { DataQualityViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

/**
 * Honest data-quality status — GA4/Yandex show NOT_CONFIGURED rather than a
 * fabricated "healthy" figure, since no server-side reconciliation exists
 * yet (see docs/engineering/backlog.md). Every visitor-derived KPI
 * elsewhere on this page stays PROVISIONAL until that ships.
 */
export function DataQualityBlock({ model }: { model: DataQualityViewModel }) {
  const block = getDashboardBlock("dataQuality");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">Внутренняя телеметрия</span>
        <span className={`text-sm font-medium ${model.internalEventsOk ? "text-green-600" : "text-red-600"}`}>
          {model.internalEventsOk ? "OK" : "Устарело"}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">GA4</span>
          <span className="text-gray-400">не подключено</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Yandex Metrica</span>
          <span className="text-gray-400">не подключено</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Identity reconciliation</span>
          <span className="text-gray-400">не применимо</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        Visitor-метрики (MAU/WAU/WPF/Retention/Habit) остаются PROVISIONAL до подключения GA4/Yandex reconciliation.
      </div>
    </AdminDashboardBlock>
  );
}
