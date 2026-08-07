"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type { AnalyticsContentPerformanceResult } from "@/lib/analytics/analyticsContentPerformanceTypes";
import { cn } from "@/lib/utils";
import { TableContainer } from "@/components/ui/table";

function buildQuery(
  filters: AnalyticsOverviewFilters,
  extra: Record<string, string>,
): string {
  const q = new URLSearchParams();
  q.set("dateRange", filters.dateRange);
  q.set("entity", filters.entity);
  q.set("vertical", filters.vertical);
  q.set("city", filters.city);
  q.set("segment", filters.segment);
  q.set("childAgeBand", filters.childAgeBand);
  for (const [k, v] of Object.entries(extra)) {
    q.set(k, v);
  }
  return q.toString();
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

const TABLE_SORT_KEYS = [
  "title",
  "entityType",
  "vertical",
  "cityName",
  "views",
  "opens",
  "saves",
  "planAdds",
  "ctaClicks",
  "openRate",
  "saveRate",
  "planRate",
  "clickRateVsOpens",
  "clickRateVsPlans",
] as const;

export function AdminAnalyticsContentPerformance({
  filters,
}: {
  filters: AnalyticsOverviewFilters;
}) {
  const [data, setData] = useState<AnalyticsContentPerformanceResult | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>("views");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildQuery(filters, {
        page: String(page),
        pageSize: "25",
        sortKey,
        sortDir,
      });
      const res = await fetch(
        `/api/admin/analytics/content-performance?${q}`,
        { credentials: "include" },
      );
      const json = (await res.json()) as
        | AnalyticsContentPerformanceResult
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          "error" in json && json.error ? json.error : `HTTP ${res.status}`,
        );
      }
      if ("performanceTable" in json) {
        setData(json);
      }
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortKey, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
    setPage(1);
  };

  if (loading && !data) {
    return (
      <p className="text-sm text-gray-500">Loading content performance…</p>
    );
  }
  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const totalPages = Math.max(
    1,
    Math.ceil(data.performanceTotal / data.pageSize),
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        Aggregated events (not raw rows).{" "}
        {new Date(data.range.start).toLocaleDateString()} —{" "}
        {new Date(data.range.end).toLocaleDateString()}
        {loading ? " · updating…" : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TopBlock title="Top views" items={data.topViews} metric="views" />
        <TopBlock title="Top opens" items={data.topOpens} metric="opens" />
        <TopBlock title="Top saves" items={data.topSaves} metric="saves" />
        <TopBlock
          title="Top plan adds"
          items={data.topPlanAdds}
          metric="planAdds"
        />
        <TopBlock
          title="Top CTA"
          items={data.topClicks}
          metric="ctaClicks"
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Performance table
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {data.performanceTotal.toLocaleString()} entities (max 400). Page{" "}
          {data.page} of {totalPages}.
        </p>
        <div className="mt-3">
          <TableContainer minWidthClassName="min-w-[1100px]" scrollLabel="Таблица показателей контента, прокручивается по горизонтали">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/90">
                {TABLE_SORT_KEYS.map((k) => (
                  <th
                    key={k}
                    className="whitespace-nowrap px-2 py-2 font-semibold text-gray-700"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(k)}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded hover:bg-gray-100",
                        sortKey === k && "text-gray-900",
                      )}
                    >
                      {labelForKey(k)}
                      <ChevronsUpDown className="size-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.performanceTable.map((row) => (
                <tr
                  key={`${row.entityType}-${row.entityId}`}
                  className="border-b border-gray-100 hover:bg-gray-50/80"
                >
                  <td className="max-w-[200px] truncate px-2 py-1.5 font-medium text-gray-900">
                    {row.title}
                  </td>
                  <td className="px-2 py-1.5 text-gray-700">{row.entityType}</td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {row.vertical ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {row.cityName ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{row.views}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.opens}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.saves}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.planAdds}</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.ctaClicks}</td>
                  <td className="px-2 py-1.5 tabular-nums">{pct(row.openRate)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{pct(row.saveRate)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{pct(row.planRate)}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {pct(row.clickRateVsOpens)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {pct(row.clickRateVsPlans)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableContainer>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </section>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Best converters
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Thresholds: save rate (views≥10, opens≥3); plan rate (saves≥3); CTA/opens
          (opens≥5).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ConverterList
            title="Save rate"
            rows={data.bestConverters.bySaveRate}
            rate={(r) => pct(r.saveRate)}
          />
          <ConverterList
            title="Plan rate"
            rows={data.bestConverters.byPlanRate}
            rate={(r) => pct(r.planRate)}
          />
          <ConverterList
            title="CTA / opens"
            rows={data.bestConverters.byClickRate}
            rate={(r) => pct(r.clickRateVsOpens)}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Worst converters (high traffic, low save rate)
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          views ≥ 35, opens ≥ 5, save rate &lt; 12%
        </p>
        <ul className="mt-2 space-y-2">
          {data.worstConverters.length === 0 ? (
            <li className="text-xs text-gray-500">No matches</li>
          ) : (
            data.worstConverters.map((r) => (
              <li
                key={`${r.entityType}-${r.entityId}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-100/80 pb-2 text-xs last:border-0"
              >
                <span className="font-medium text-gray-900">{r.title}</span>
                <span className="text-gray-600">
                  views {r.views} · save {pct(r.saveRate)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonBlock
          title="Entity type"
          rows={data.entityTypeComparison}
        />
        <ComparisonBlock
          title="Vertical"
          rows={data.verticalComparison}
        />
      </div>
    </div>
  );
}

function labelForKey(k: string): string {
  const m: Record<string, string> = {
    title: "Title",
    entityType: "Type",
    vertical: "Vertical",
    cityName: "City",
    views: "Views",
    opens: "Opens",
    saves: "Saves",
    planAdds: "Plan",
    ctaClicks: "CTA",
    openRate: "Open %",
    saveRate: "Save %",
    planRate: "Plan %",
    clickRateVsOpens: "CTA/opens",
    clickRateVsPlans: "CTA/plan",
  };
  return m[k] ?? k;
}

function TopBlock({
  title,
  items,
  metric,
}: {
  title: string;
  items: AnalyticsContentPerformanceResult["topViews"];
  metric: "views" | "opens" | "saves" | "planAdds" | "ctaClicks";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-[11px] text-gray-500">No data</li>
        ) : (
          items.map((it) => (
            <li
              key={`${it.entityType}-${it.entityId}`}
              className="border-b border-gray-50 pb-1.5 text-[11px] last:border-0"
            >
              <p className="line-clamp-2 font-medium leading-snug text-gray-900">
                {it.title}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-500">
                {it.entityType}
                {it.vertical ? ` · ${it.vertical}` : ""}
                {it.cityName ? ` · ${it.cityName}` : ""}
              </p>
              <p className="text-[10px] tabular-nums text-gray-700">
                {metric}: {it.primaryMetric.toLocaleString()} · saves{" "}
                {it.saves} · plan {it.planAdds}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ConverterList({
  title,
  rows,
  rate,
}: {
  title: string;
  rows: AnalyticsContentPerformanceResult["bestConverters"]["bySaveRate"];
  rate: (r: (typeof rows)[number]) => string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-800">{title}</p>
      <ul className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <li className="text-[11px] text-gray-500">No data</li>
        ) : (
          rows.map((r) => (
            <li
              key={`${r.entityType}-${r.entityId}`}
              className="border-b border-gray-100 pb-2 text-[11px] last:border-0"
            >
              <p className="line-clamp-2 font-medium text-gray-900">{r.title}</p>
              <p className="text-[10px] text-gray-600">{rate(r)}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ComparisonBlock({
  title,
  rows,
}: {
  title: string;
  rows: AnalyticsContentPerformanceResult["entityTypeComparison"];
}) {
  const maxV = Math.max(1, ...rows.map((r) => r.views));
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-gray-500">No data</p>
        ) : (
          rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-gray-800">{r.label}</span>
                <span className="tabular-nums text-gray-600">
                  v{r.views} · save {pct(r.saveRate)}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted/50">
                <div
                  className="bg-primary/60"
                  style={{ width: `${(r.views / maxV) * 100}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-gray-500">
                opens {r.opens} · saves {r.saves} · plans {r.planAdds} · CTA{" "}
                {r.ctaClicks} · plan {pct(r.planRate)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
