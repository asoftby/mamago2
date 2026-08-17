import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { TrafficViewModel } from "@/server/admin/getTrafficViewModel";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function formatDelta(deltaPercent: number | null): string | null {
  if (deltaPercent === null) return null;
  const sign = deltaPercent > 0 ? "+" : "";
  return `${sign}${deltaPercent}%`;
}

function DeltaLabel({ deltaPercent }: { deltaPercent: number | null }) {
  const delta = formatDelta(deltaPercent);
  if (delta === null) return null;
  return (
    <span className={`text-xs ${deltaPercent! >= 0 ? "text-green-600" : "text-red-600"}`}>
      {delta}
    </span>
  );
}

export function TrafficBlock({ model }: { model: TrafficViewModel }) {
  const block = getDashboardBlock("traffic");

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500">Сегодня</div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-gray-500">Уникальные</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {model.uniqueVisitorsToday === null ? "Нет данных" : model.uniqueVisitorsToday}
              </span>
              <DeltaLabel deltaPercent={model.visitorsDeltaPercent} />
            </div>
          </div>
          <div>
            <div className="text-gray-500">Просмотры</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {model.pageViewsToday === null ? "Нет данных" : model.pageViewsToday}
              </span>
              <DeltaLabel deltaPercent={model.pageViewsDeltaPercent} />
            </div>
          </div>
          <div>
            <div className="text-gray-500">Просм./чел.</div>
            <div className="text-lg font-bold text-gray-900">
              {model.pageViewsPerVisitor === null ? "—" : model.pageViewsPerVisitor}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
          По регионам: нет данных (ожидает подтверждения доверенного IP на хосте)
        </div>
      </div>
    </AdminDashboardBlock>
  );
}
