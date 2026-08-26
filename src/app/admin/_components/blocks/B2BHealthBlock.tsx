import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { B2BHealthViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmt(value: number | null): string {
  return value === null ? "Нет данных" : value.toLocaleString("ru-RU");
}

/**
 * Repeat Promotion Rate / Revenue are intentionally absent — paid Promotion
 * is disabled in prod and no reliable revenue source exists yet. See
 * docs/engineering/backlog.md; do not fabricate placeholder values here.
 */
export function B2BHealthBlock({ model }: { model: B2BHealthViewModel }) {
  const block = getDashboardBlock("b2b");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.activeBusinesses)}</div>
          <div className="text-xs text-gray-500">Active Businesses</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmt(model.newBusinesses30d)}</div>
          <div className="text-xs text-gray-500">Новые / 30д</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">
            {model.meaningfulActionRate === null ? "Нет данных" : `${Math.round(model.meaningfulActionRate * 100)}%`}
          </div>
          <div className="text-xs text-gray-500">Получили действие (30д)</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
        Repeat Promotion Rate / Revenue: недоступно (платные promotion отключены в проде)
      </div>
    </AdminDashboardBlock>
  );
}
