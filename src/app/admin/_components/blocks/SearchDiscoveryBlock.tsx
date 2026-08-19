import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { SearchDiscoveryViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

export function SearchDiscoveryBlock({ model }: { model: SearchDiscoveryViewModel }) {
  const block = getDashboardBlock("search");

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-lg font-bold text-gray-900">
            {model.queriesTotal === null ? "Нет данных" : model.queriesTotal}
          </div>
          <div className="text-xs text-gray-500">Запросов</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">
            {model.zeroResultRate === null ? "—" : `${Math.round(model.zeroResultRate * 100)}%`}
          </div>
          <div className="text-xs text-gray-500">Без результатов</div>
        </div>
      </div>
    </AdminDashboardBlock>
  );
}
