import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { GscPageMoverViewModel, GscSeoViewModel } from "@/lib/admin/gscSeoViewModel";

function formatCount(value: number | null): string {
  return value === null ? "Нет данных" : new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function formatDelta(value: number | null, unit: "%" | " п.п." | ""): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value}${unit}`;
}

function Metric({ label, value, delta, deltaUnit = "%", improvementIsNegative = false }: {
  label: string;
  value: string;
  delta: number | null;
  deltaUnit?: "%" | " п.п." | "";
  improvementIsNegative?: boolean;
}) {
  const isGood = delta === null ? null : improvementIsNegative ? delta <= 0 : delta >= 0;
  return (
    <div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      <div className={`text-xs mt-1 ${isGood === null ? "text-gray-400" : isGood ? "text-green-600" : "text-red-600"}`}>
        {formatDelta(delta, deltaUnit)}
      </div>
    </div>
  );
}

function Movers({ title, rows }: { title: string; rows: GscPageMoverViewModel[] }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-gray-400">Нет данных</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={`${row.page}:${row.deltaClicks}`} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-gray-700" title={row.page}>{row.page}</span>
              <span className={row.deltaClicks >= 0 ? "text-green-600" : "text-red-600"}>
                {row.deltaClicks > 0 ? "+" : ""}{Math.round(row.deltaClicks)} кликов
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GscSeoBlock({ model }: { model: GscSeoViewModel }) {
  return (
    <AdminDashboardBlock title="SEO · Google Search Console" size="wide">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Клики · 7д" value={formatCount(model.clicks)} delta={model.clicksChangePercent} />
        <Metric label="Показы · 7д" value={formatCount(model.impressions)} delta={model.impressionsChangePercent} />
        <Metric
          label="CTR · изменение, п.п."
          value={model.ctr === null ? "Нет данных" : `${(model.ctr * 100).toFixed(1)}%`}
          delta={model.ctrDeltaPp}
          deltaUnit=" п.п."
        />
        <Metric
          label="Средняя позиция · изменение"
          value={model.position === null ? "Нет данных" : model.position.toFixed(1)}
          delta={model.positionDelta}
          deltaUnit=""
          improvementIsNegative
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
        <Movers title="Растут сильнее всего" rows={model.rising} />
        <Movers title="Падают сильнее всего" rows={model.falling} />
      </div>
      <div className="mt-3 text-[11px] text-gray-400">
        Сравнение двух завершённых 7-дневных периодов; последние 3 дня исключены из-за задержки данных GSC.
      </div>
    </AdminDashboardBlock>
  );
}
