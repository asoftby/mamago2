"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnalyticsOverviewFilters,
  AnalyticsOverviewResult,
} from "@/lib/analytics/adminOverviewTypes";
import { AdminAnalyticsOverviewSkeleton } from "./AdminAnalyticsOverviewSkeleton";

function buildQuery(filters: AnalyticsOverviewFilters): string {
  const q = new URLSearchParams();
  q.set("dateRange", filters.dateRange);
  q.set("entity", filters.entity);
  q.set("vertical", filters.vertical);
  q.set("city", filters.city);
  q.set("segment", filters.segment);
  q.set("childAgeBand", filters.childAgeBand);
  return q.toString();
}

function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function formatRangeLabel(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${a.toLocaleDateString("en-CA", opts)} — ${b.toLocaleDateString("en-CA", opts)}`;
}

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function AdminAnalyticsOverview({
  filters,
}: {
  filters: AnalyticsOverviewFilters;
}) {
  const [data, setData] = useState<AnalyticsOverviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => buildQuery(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/analytics/overview?${queryKey}`,
          { credentials: "include" },
        );
        const payload = (await res.json()) as
          | AnalyticsOverviewResult
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : `HTTP ${res.status}`,
          );
        }
        if (!cancelled) {
          setData(payload as AnalyticsOverviewResult);
        }
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  if (loading) {
    return <AdminAnalyticsOverviewSkeleton />;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return null;
  }

  const maxDaily = Math.max(
    1,
    ...data.dailySeries.map((d) => Math.max(d.views, d.opens)),
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        {formatRangeLabel(data.range.start, data.range.end)}
      </p>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Key metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Active users"
            value={data.activeUsers.toLocaleString()}
            subtitle={`Profiles seen: ${data.profilesActiveInRange.toLocaleString()}`}
          />
          <KpiCard
            label="Sessions"
            value={data.sessions.toLocaleString()}
          />
          <KpiCard label="Views" value={data.views.toLocaleString()} />
          <KpiCard label="Opens" value={data.opens.toLocaleString()} />
          <KpiCard label="Saves" value={data.saves.toLocaleString()} />
          <KpiCard
            label="Plan adds"
            value={data.planAdds.toLocaleString()}
          />
          <KpiCard
            label="CTA clicks"
            value={data.ctaClicks.toLocaleString()}
          />
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-600">Conversion rates</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2 tabular-nums">
                <dt className="text-gray-500">Save rate</dt>
                <dd className="font-medium text-gray-900">
                  {formatPct(data.saveRate)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <dt className="text-gray-500">Plan rate</dt>
                <dd className="font-medium text-gray-900">
                  {formatPct(data.planRate)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <dt className="text-gray-500">Click rate</dt>
                <dd className="font-medium text-gray-900">
                  {formatPct(data.clickRate)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Funnel</h3>
          <div className="space-y-3">
            {data.funnel.map((step) => (
              <div key={step.key} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs tabular-nums text-gray-500">
                  {step.percentOfTop.toFixed(1)}%
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="h-9 max-w-full rounded-lg bg-primary/15 transition-[width]"
                    style={{ width: `${Math.min(100, step.percentOfTop)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-gray-600">
                  {step.label}{" "}
                  <span className="font-medium text-gray-900">
                    {step.count.toLocaleString()}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Views & opens (daily)
          </h3>
          <div className="flex h-[180px] items-end justify-between gap-1 rounded-xl bg-muted/20 px-2 pb-1 pt-2">
            {data.dailySeries.map((d) => (
              <div
                key={d.date}
                className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${d.date}: views ${d.views}, opens ${d.opens}`}
              >
                <div className="flex h-[140px] w-full items-end justify-center gap-0.5">
                  <div
                    className="w-1/2 max-w-[8px] rounded-t-sm bg-primary/60"
                    style={{
                      height: `${Math.max(2, (d.views / maxDaily) * 100)}%`,
                    }}
                  />
                  <div
                    className="w-1/2 max-w-[8px] rounded-t-sm bg-amber-500/70"
                    style={{
                      height: `${Math.max(2, (d.opens / maxDaily) * 100)}%`,
                    }}
                  />
                </div>
                <span className="max-w-full truncate text-[10px] leading-tight text-muted-foreground">
                  {d.day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-primary/60" />
              Views
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-amber-500/70" />
              Opens
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Top verticals
          </h3>
          <ul className="space-y-3">
            {data.topVerticals.length === 0 ? (
              <li className="text-sm text-gray-500">No data</li>
            ) : (
              data.topVerticals.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 border-b border-gray-50 pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-gray-800">
                    {row.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-600">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">
            Top entities
          </h3>
          <ul className="space-y-3">
            {data.topEntities.length === 0 ? (
              <li className="text-sm text-gray-500">No data</li>
            ) : (
              data.topEntities.map((row) => (
                <li
                  key={`${row.label}-${row.sublabel ?? ""}`}
                  className="flex items-start justify-between gap-3 border-b border-gray-50 pb-3 text-sm last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-gray-800">{row.label}</p>
                    {row.sublabel ? (
                      <p className="truncate font-mono text-xs text-gray-500">
                        {row.sublabel}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 tabular-nums text-gray-600">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
