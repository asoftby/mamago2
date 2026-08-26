import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { EngagementFunnelViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/**
 * Independent rates from engagedUsers, NOT a fabricated sequential funnel —
 * PLAN_ADD isn't gated behind a prior SAVE in this product, so showing
 * "% of savers who planned" would misrepresent the data. See
 * deriveEngagementFunnel / Metric Dictionary.
 */
export function FunnelBlock({ model }: { model: EngagementFunnelViewModel }) {
  const block = getDashboardBlock("funnel");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">Engaged content users (30д)</span>
        <span className="text-lg font-bold text-gray-900">
          {model.engagedUsers === null ? "Нет данных" : model.engagedUsers.toLocaleString("ru-RU")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center pt-3 border-t border-gray-100">
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.saveRate)}</div>
          <div className="text-xs text-gray-500">Save rate</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.planRate)}</div>
          <div className="text-xs text-gray-500">Plan rate</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.ctaRate)}</div>
          <div className="text-xs text-gray-500">CTA rate</div>
        </div>
      </div>
    </AdminDashboardBlock>
  );
}
