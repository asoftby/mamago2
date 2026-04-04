"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AnalyticsSegmentDetailResult } from "@/lib/analytics/analyticsSegmentsTypes";
import {
  segmentDescription,
  segmentTitle,
} from "@/lib/analytics/segmentCatalog";

function buildQuery(sp: URLSearchParams): string {
  const q = new URLSearchParams();
  const dr = sp.get("dateRange") ?? "30d";
  const city = sp.get("city") ?? "";
  q.set("dateRange", dr);
  q.set("city", city);
  return q.toString();
}

export function AdminSegmentDetailClient({
  segmentKey,
}: {
  segmentKey: string;
}) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<AnalyticsSegmentDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = buildQuery(searchParams);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/analytics/segments/${encodeURIComponent(segmentKey)}?${qs}`,
          { credentials: "include" },
        );
        const json = (await res.json()) as
          | AnalyticsSegmentDetailResult
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            "error" in json && json.error ? json.error : `HTTP ${res.status}`,
          );
        }
        if (!cancelled && "usersCount" in json) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [segmentKey, qs]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Loading segment…</p>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error ?? "Not found"}
      </div>
    );
  }

  const maxTrend = Math.max(
    1,
    ...data.trend.map((t) => t.usersCount),
  );
  const maxFunnel = Math.max(
    1,
    data.funnel.views,
    data.funnel.opens,
    data.funnel.saves,
    data.funnel.planAdds,
    data.funnel.ctaClicks,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {segmentTitle(data.key)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
          {segmentDescription(data.key)}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Range: {new Date(data.range.start).toLocaleDateString()} —{" "}
          {new Date(data.range.end).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Users in segment" value={data.usersCount.toLocaleString()} />
        <Kpi
          label="Avg saves"
          value={data.avgSaves.toLocaleString()}
        />
        <Kpi
          label="Avg plan adds"
          value={data.avgPlanAdds.toLocaleString()}
        />
        <Kpi
          label="Avg CTA clicks"
          value={data.avgCtaClicks.toLocaleString()}
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Last activity by day (UTC)
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          Users counted on the calendar day of their last seen timestamp.
        </p>
        <div className="flex h-40 items-end gap-px overflow-x-auto pb-1">
          {data.trend.map((t) => (
            <div
              key={t.date}
              className="flex min-w-[6px] flex-1 flex-col items-center gap-1"
              title={`${t.date}: ${t.usersCount}`}
            >
              <div
                className="w-full max-w-[12px] rounded-t-sm bg-primary/70"
                style={{
                  height: `${Math.max(4, (t.usersCount / maxTrend) * 100)}%`,
                }}
              />
              <span className="max-w-[48px] truncate text-[9px] text-gray-400">
                {t.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Funnel (sum of profile totals)
        </h2>
        <div className="space-y-2">
          {(
            [
              ["Views", data.funnel.views],
              ["Opens", data.funnel.opens],
              ["Saves", data.funnel.saves],
              ["Plan adds", data.funnel.planAdds],
              ["CTA clicks", data.funnel.ctaClicks],
            ] as const
          ).map(([label, count]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-24 text-xs text-gray-500">{label}</span>
              <div className="h-8 min-w-0 flex-1 rounded-lg bg-muted/40">
                <div
                  className="h-full rounded-lg bg-primary/30"
                  style={{
                    width: `${Math.min(100, (count / maxFunnel) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-xs tabular-nums text-gray-800">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <TopBlock title="Top categories" items={data.topCategories} />
        <TopBlock title="Top verticals" items={data.topVerticals} />
        <TopBlock title="Top formats" items={data.topFormats} />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Top content (events in range, aggregated)
        </h2>
        {data.topContent.length === 0 ? (
          <p className="text-sm text-gray-500">No data</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.topContent.map((row) => (
              <li
                key={`${row.entityType}-${row.entityId}`}
                className="flex items-start justify-between gap-4 py-3 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {row.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {row.entityType} · {row.entityId.slice(0, 12)}
                    …
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm text-gray-700">
                  {row.eventsCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-gray-400">
        <Link href={`/admin/analytics?${qs}`} className="text-primary hover:underline">
          ← Back to Analytics
        </Link>
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">
        {value}
      </p>
    </div>
  );
}

function TopBlock({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No data</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={i.label}
              className="flex justify-between gap-2 text-sm text-gray-800"
            >
              <span className="min-w-0 truncate">{i.label}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
                {i.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
