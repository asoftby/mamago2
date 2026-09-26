import { AdminDashboardBlock } from "../AdminDashboardBlock";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";
import { MIN_RATE_SAMPLE, type GrowthOverviewViewModel } from "@/lib/admin/growthDashboardViewModel";
import { fmtInt, fmtPct } from "./growthFormat";

/**
 * Of the people who opened a card, how many did something valuable with it.
 * Independent rates, not a sequential funnel (PLAN_ADD isn't gated behind a
 * SAVE). Hidden below MIN_RATE_SAMPLE users — a 50% rate out of 2 people is
 * noise, not a signal.
 */
export function ValuePathBlock({ model }: { model: GrowthOverviewViewModel }) {
  const block = getDashboardBlock("valuePath");

  return (
    <AdminDashboardBlock title={block.title} href={block.href} size={block.size}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">Открыли карточку события или места</span>
        <span className="text-lg font-bold text-gray-900">{fmtInt(model.engagedUsers)}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 text-center pt-3 border-t border-gray-100 sm:grid-cols-3 sm:gap-3">
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.saveRate)}</div>
          <div className="text-xs text-gray-500">сохранили</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.planRate)}</div>
          <div className="text-xs text-gray-500">добавили в план</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-900">{fmtPct(model.ctaRate)}</div>
          <div className="text-xs text-gray-500">перешли к записи или покупке</div>
        </div>
      </div>
      {!model.ratesReliable && model.engagedUsers !== null && (
        <div className="mt-3 text-xs text-gray-400">
          Доли покажем от {MIN_RATE_SAMPLE} пользователей — сейчас их слишком мало для процентов.
        </div>
      )}
    </AdminDashboardBlock>
  );
}
