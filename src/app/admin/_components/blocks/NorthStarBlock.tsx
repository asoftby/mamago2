import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { NorthStarViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function formatDelta(deltaPercent: number | null): string | null {
  if (deltaPercent === null) return null;
  const sign = deltaPercent > 0 ? "+" : "";
  return `${sign}${deltaPercent}% WoW`;
}

/** WPF is the North Star metric — visually distinct (accent border + larger figure) per the product spec. */
export function NorthStarBlock({ model }: { model: NorthStarViewModel }) {
  const block = getDashboardBlock("northStar");
  const delta = formatDelta(model.wpfWoWPercent);

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="rounded-md border-2 border-indigo-200 bg-indigo-50/50 p-3 -m-1">
        <div className="text-2xl font-bold text-indigo-900">
          {model.wpf === null ? "Нет данных" : model.wpf.toLocaleString("ru-RU")}
        </div>
        {delta && (
          <div className={`text-xs mt-0.5 ${model.wpfWoWPercent! >= 0 ? "text-green-600" : "text-red-600"}`}>
            {delta}
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">Planning Penetration</span>
        <span className="text-sm font-medium text-gray-900">
          {model.planningPenetration === null ? "Нет данных" : `${Math.round(model.planningPenetration * 100)}%`}
        </span>
      </div>
    </AdminDashboardBlock>
  );
}
