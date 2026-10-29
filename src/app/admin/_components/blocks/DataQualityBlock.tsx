import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { DataQualityViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";

function fmtShare(value: number | null): string {
  if (value === null) return "Нет данных";
  const pct = value * 100;
  return `${pct > 0 && pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/**
 * Data Quality (ТЗ «Аналитика админки», A3): насколько чист входящий поток
 * продуктовой телеметрии. Доли отсеянных запросов — от всех клиентских
 * запросов к `/api/analytics/events` за окно; «без идентичности» — анонимы
 * без sessionId (не записаны) и уже записанные события без userId/sessionId.
 */
export function DataQualityBlock({ model }: { model: DataQualityViewModel }) {
  const block = getDashboardBlock("dataQuality");
  const rows: { label: string; value: number | null; hint: string }[] = [
    {
      label: "Отсеяно ботов · 24 ч",
      value: model.botRejectedShare24h,
      hint: "Боты по User-Agent / все клиентские запросы телеметрии за 24 часа",
    },
    {
      label: "Отсеяно ботов · 7 дней",
      value: model.botRejectedShare7d,
      hint: "Боты по User-Agent / все клиентские запросы телеметрии за 7 дней",
    },
    {
      label: "Запросы без идентичности · 24 ч",
      value: model.noIdentityRejectedShare24h,
      hint: "Анонимные запросы без sessionId (не записаны) / все клиентские запросы за 24 часа",
    },
    {
      label: "События без идентичности · 24 ч",
      value: model.storedWithoutIdentityShare24h,
      hint: "Записанные события без userId, sessionId и anonymousId / все события за 24 часа",
    },
  ];

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0" title={row.hint}>
            <span className="text-sm text-gray-600">{row.label}</span>
            <span className={`text-sm font-medium ${row.value === null ? "text-gray-400" : "text-gray-900"}`}>
              {fmtShare(row.value)}
            </span>
          </div>
        ))}
      </div>
    </AdminDashboardBlock>
  );
}
