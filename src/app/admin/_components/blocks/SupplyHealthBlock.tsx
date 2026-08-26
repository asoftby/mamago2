import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { SupplyHealthViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmt(value: number | null): string {
  return value === null ? "Нет данных" : value.toLocaleString("ru-RU");
}

export function SupplyHealthBlock({ model }: { model: SupplyHealthViewModel }) {
  const block = getDashboardBlock("supply");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.activeEvents)}</div>
          <div className="text-xs text-gray-500">События</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.activePlaces)}</div>
          <div className="text-xs text-gray-500">Места</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.activeOffers)}</div>
          <div className="text-xs text-gray-500">Предложения</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Content freshness (≤7д, тех. proxy)</span>
        <span className="text-sm font-medium text-gray-900">
          {model.contentFreshnessPct === null ? "Нет данных" : `${Math.round(model.contentFreshnessPct * 100)}%`}
        </span>
      </div>
    </AdminDashboardBlock>
  );
}
