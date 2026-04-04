"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsBehaviorResult,
  BehaviorGapItem,
} from "@/lib/analytics/analyticsBehaviorTypes";
import { cn } from "@/lib/utils";

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

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function HBar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className?: string;
}) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-xs text-gray-600">{label}</span>
      <div className="min-w-0 flex-1 h-2 rounded-full bg-muted/60">
        <div
          className={cn("h-2 rounded-full transition-[width]", className ?? "bg-primary/70")}
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-gray-700">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminAnalyticsBehavior({
  filters,
}: {
  filters: AnalyticsOverviewFilters;
}) {
  const [data, setData] = useState<AnalyticsBehaviorResult | null>(null);
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
          `/api/admin/analytics/behavior?${queryKey}`,
          { credentials: "include" },
        );
        const json = (await res.json()) as AnalyticsBehaviorResult | {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            "error" in json && json.error ? json.error : `HTTP ${res.status}`,
          );
        }
        if (!cancelled && "activityByTime" in json) {
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
  }, [queryKey]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Loading behavior insights…</p>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error ?? "No data"}
      </div>
    );
  }

  const maxTime = Math.max(
    1,
    ...data.activityByTime.map((x) => x.events),
  );
  const maxDow = Math.max(1, ...data.activityByDay.map((x) => x.events));
  const maxAge = Math.max(
    1,
    ...data.ageBreakdown.map((x) => x.views + x.saves + x.planAdds),
  );
  const maxSig = Math.max(1, ...data.signalsBreakdown.map((x) => x.views));
  const maxCat = Math.max(1, ...data.categoryBreakdown.map((x) => x.views));
  const maxFmt = Math.max(1, ...data.formatBreakdown.map((x) => x.views));
  const maxVert = Math.max(
    1,
    ...data.verticalBreakdown.map((x) => x.views),
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {data.timezoneNote}. Range:{" "}
        {new Date(data.range.start).toLocaleDateString()} —{" "}
        {new Date(data.range.end).toLocaleDateString()}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Activity by time of day"
          subtitle="Event counts (UTC buckets)."
        >
          <div className="space-y-2">
            {data.activityByTime.map((row) => (
              <HBar
                key={row.key}
                label={row.label}
                value={row.events}
                max={maxTime}
              />
            ))}
            <p className="pt-2 text-[11px] text-gray-400">
              Sessions (distinct) are lower than events; same pattern applies.
            </p>
          </div>
        </Section>

        <Section
          title="Activity by weekday"
          subtitle="Events per ISO weekday (Mon–Sun)."
        >
          <div className="space-y-2">
            {data.activityByDay.map((row) => (
              <HBar
                key={row.isoDow}
                label={`${row.label} · users ${row.activeUsers.toLocaleString()}`}
                value={row.events}
                max={maxDow}
                className="bg-violet-500/70"
              />
            ))}
          </div>
        </Section>
      </div>

      <Section
        title="Planning behavior"
        subtitle="Profile-weighted averages (users with events in range). Next-day uses PLAN_ADD meta when present."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2">
            <p className="text-[11px] font-medium text-gray-500">Same-day</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {pct(data.planning.sameDayShare)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2">
            <p className="text-[11px] font-medium text-gray-500">Next-day</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {data.planning.nextDayShare == null
                ? "—"
                : pct(data.planning.nextDayShare)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2">
            <p className="text-[11px] font-medium text-gray-500">Advance</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {pct(data.planning.advanceShare)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/90 px-3 py-2">
            <p className="text-[11px] font-medium text-gray-500">Weekend</p>
            <p className="text-lg font-semibold tabular-nums text-gray-900">
              {pct(data.planning.weekendShare)}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Interaction gaps"
        subtitle="Entities with strong upstream volume but weak downstream conversion (heuristic thresholds)."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <GapList
            title="Open → no save"
            hint="High opens, low save rate"
            rows={data.interactionGaps.openNoSave}
            aLabel="Opens"
            bLabel="Saves"
          />
          <GapList
            title="Save → no plan"
            hint="High saves, low plan rate"
            rows={data.interactionGaps.saveNoPlan}
            aLabel="Saves"
            bLabel="Plans"
          />
          <GapList
            title="Plan → no CTA"
            hint="Plans with weak CTA rate"
            rows={data.interactionGaps.planNoClick}
            aLabel="Plans"
            bLabel="CTA"
          />
        </div>
      </Section>

      <Section
        title="By child age (youngest child)"
        subtitle="Events attributed to the youngest child’s age band; unknown = no birth date."
      >
        <div className="space-y-2">
          {data.ageBreakdown.map((row) => (
            <div key={row.band} className="space-y-1">
              <p className="text-xs font-medium text-gray-700">
                {row.band === "unknown" ? "Unknown" : `${row.band} yrs`}
              </p>
              <HBar
                label="Views"
                value={row.views}
                max={maxAge}
                className="bg-sky-500/70"
              />
              <HBar
                label="Saves"
                value={row.saves}
                max={maxAge}
                className="bg-amber-500/70"
              />
              <HBar
                label="Plan adds"
                value={row.planAdds}
                max={maxAge}
                className="bg-emerald-600/70"
              />
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section
          title="Signals (profile)"
          subtitle="How often users in range selected each preference (counts, not event views)."
        >
          <div className="space-y-2">
            {data.signalsBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500">No data</p>
            ) : (
              data.signalsBreakdown.map((row) => (
                <HBar
                  key={row.key}
                  label={row.label}
                  value={row.views}
                  max={maxSig}
                  className="bg-indigo-500/70"
                />
              ))
            )}
          </div>
        </Section>
        <Section
          title="Categories (profile)"
          subtitle="Weighted mix from preferred categories."
        >
          <div className="space-y-2">
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500">No data</p>
            ) : (
              data.categoryBreakdown.map((row) => (
                <HBar
                  key={row.key}
                  label={row.label}
                  value={row.views}
                  max={maxCat}
                  className="bg-orange-500/70"
                />
              ))
            )}
          </div>
        </Section>
        <Section title="Formats (grouped)" subtitle="Mapped from signal slugs.">
          <div className="space-y-2">
            {data.formatBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500">No data</p>
            ) : (
              data.formatBreakdown.map((row) => (
                <HBar
                  key={row.key}
                  label={row.label}
                  value={row.views}
                  max={maxFmt}
                  className="bg-teal-600/70"
                />
              ))
            )}
          </div>
        </Section>
      </div>

      <Section
        title="By vertical"
        subtitle="From events in range (views, saves, plans, CTA)."
      >
        <div className="space-y-3">
          {data.verticalBreakdown.length === 0 ? (
            <p className="text-xs text-gray-500">No data</p>
          ) : (
            data.verticalBreakdown.map((row) => (
              <div key={row.key} className="space-y-1 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <p className="text-xs font-medium text-gray-800">{row.label}</p>
                <HBar label="Views" value={row.views} max={maxVert} />
                <HBar
                  label="Saves"
                  value={row.saves}
                  max={maxVert}
                  className="bg-amber-500/70"
                />
                <HBar
                  label="Plans"
                  value={row.planAdds}
                  max={maxVert}
                  className="bg-emerald-600/70"
                />
                <HBar
                  label="CTA"
                  value={row.ctaClicks ?? 0}
                  max={maxVert}
                  className="bg-rose-500/70"
                />
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function GapList({
  title,
  hint,
  rows,
  aLabel,
  bLabel,
}: {
  title: string;
  hint: string;
  rows: BehaviorGapItem[];
  aLabel: string;
  bLabel: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <p className="text-xs font-semibold text-gray-900">{title}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
      <ul className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <li className="text-xs text-gray-500">No entities matched</li>
        ) : (
          rows.map((r) => (
            <li
              key={`${r.entityType}-${r.entityId}`}
              className="border-b border-gray-100 pb-2 text-xs last:border-0 last:pb-0"
            >
              <p className="font-medium leading-snug text-gray-900">{r.title}</p>
              <p className="text-[10px] text-gray-500">
                {r.entityType} · rate {(r.rate * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-gray-600">
                {aLabel}: {r.metricA.toLocaleString()} · {bLabel}:{" "}
                {r.metricB.toLocaleString()}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
