"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InternalTrendRow } from "@/lib/admin/seo/topics/internalTrends";
import type { GeoScope } from "@prisma/client";

type Props = {
  marketLabel: string;
  windowDays: number;
  rows: InternalTrendRow[];
  risingCount: number;
  highPotentialCount: number;
  showUnknownGeoHint: boolean;
  defaultCityId: string | null;
  defaultRegionId: string | null;
  defaultGeoScope: GeoScope;
};

export function SeoTopicsClient(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function addToPlan(row: InternalTrendRow) {
    setError(null);
    const res = await fetch("/api/admin/seo/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: row.query,
        targetQuery: row.query,
        sourceQuery: row.query,
        source: "INTERNAL_SEARCH",
        status: "IDEA",
        priority: row.opportunityTier === "high" ? "HIGH" : "MEDIUM",
        geoScope: props.defaultGeoScope,
        cityId: props.defaultGeoScope === "CITY" ? props.defaultCityId : null,
        regionId:
          props.defaultGeoScope === "REGION" ? props.defaultRegionId : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      setAdded((m) => ({ ...m, [row.queryKey]: "Уже в плане" }));
      return;
    }
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Ошибка");
      return;
    }
    setAdded((m) => ({ ...m, [row.queryKey]: "Добавлено в план" }));
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Темы и тренды</h1>
        <p className="mt-1 text-sm text-gray-500">{props.marketLabel}</p>
        <p className="mt-2 text-xs text-gray-500">
          Источник: поиск внутри mamaGo · период: последние {props.windowDays} дней
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-3 text-xs text-gray-600">
        <p className="font-medium text-gray-800">Источники</p>
        <ul className="mt-1.5 space-y-0.5">
          <li>✓ mamaGo Search</li>
          <li>○ Search Console</li>
          <li>○ Яндекс.Вебмастер</li>
          <li>○ Wordstat</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Растущих запросов</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{props.risingCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Высокий потенциал</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {props.highPotentialCount}
          </p>
        </div>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {props.showUnknownGeoHint ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          География поисковых запросов начала собираться с текущей версии; более
          ранние запросы не привязаны к городу.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-gray-50/80 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">Запрос</th>
                <th className="px-3 py-2 font-medium">Спрос</th>
                <th className="px-3 py-2 font-medium">Тренд</th>
                <th className="px-3 py-2 font-medium">Без результатов</th>
                <th className="px-3 py-2 font-medium">Потенциал</th>
                <th className="px-3 py-2 font-medium">География</th>
                <th className="px-3 py-2 font-medium">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {props.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    Нет данных внутреннего поиска за период в этом SEO-рынке.
                  </td>
                </tr>
              ) : (
                props.rows.map((row) => (
                  <tr key={row.queryKey}>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.query}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.searchesCurrent}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {row.trendLabel}
                      {row.trendDirection !== "new" && row.deltaAbs !== 0 ? (
                        <span className="ml-1 text-gray-400">
                          ({row.deltaAbs > 0 ? "+" : ""}
                          {row.deltaAbs} запросов)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">
                      {Math.round(row.zeroResultShare * 100)}%
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={
                          row.opportunityTier === "high" ? "default" : "secondary"
                        }
                      >
                        {row.opportunityLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {row.geographyLabel}
                    </td>
                    <td className="px-3 py-2.5">
                      {added[row.queryKey] ? (
                        <span className="text-xs text-emerald-700">
                          {added[row.queryKey]}
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            pending ||
                            (props.defaultGeoScope === "CITY" && !props.defaultCityId)
                          }
                          onClick={() => void addToPlan(row)}
                        >
                          В план
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
