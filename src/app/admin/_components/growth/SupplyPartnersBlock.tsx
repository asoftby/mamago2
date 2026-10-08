import { AdminDashboardBlock } from "../AdminDashboardBlock";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";
import type { GrowthOverviewViewModel } from "@/lib/admin/growthDashboardViewModel";
import { fmtInt } from "./growthFormat";

/** What families can choose from, and how many businesses are behind it. */
export function SupplyPartnersBlock({ model }: { model: GrowthOverviewViewModel }) {
  const block = getDashboardBlock("supply");

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="grid grid-cols-1 gap-1.5 text-center sm:grid-cols-3 sm:gap-2">
        <div>
          <div className="text-lg font-bold text-gray-900">{fmtInt(model.activeEvents)}</div>
          <div className="text-xs text-gray-500">событий в афише</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmtInt(model.activePlaces)}</div>
          <div className="text-xs text-gray-500">мест</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-900">{fmtInt(model.activeOffers)}</div>
          <div className="text-xs text-gray-500">предложений</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Активных партнёров</span>
          <span className="text-sm font-medium text-gray-900">{fmtInt(model.activeBusinesses)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Новых партнёров за 30 дней</span>
          <span className="text-sm font-medium text-gray-900">{fmtInt(model.newBusinesses30d)}</span>
        </div>
      </div>
    </AdminDashboardBlock>
  );
}
