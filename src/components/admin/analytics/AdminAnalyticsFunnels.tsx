"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type {
  AnalyticsFunnelSeries,
  AnalyticsFunnelWorstEntity,
  AnalyticsFunnelsResult,
} from "@/lib/analytics/analyticsFunnelsTypes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function maxStepCount(data: AnalyticsFunnelSeries): number {
  return Math.max(1, ...data.steps.map((step) => step.count));
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

function FunnelStrip({
  data,
  maxCount,
}: {
  data: AnalyticsFunnelSeries;
  maxCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
      {data.steps.map((step, i) => {
        const w =
          maxCount > 0 ? Math.min(100, (step.count / maxCount) * 100) : 0;
        return (
          <div
            key={step.key}
            className="min-w-0 flex-1 rounded-xl border border-gray-100 bg-gray-50/80 p-3"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
              {step.label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
              {step.count.toLocaleString()}
            </div>
            <div className="mt-0.5 text-xs tabular-nums text-gray-600">
              {i === 0 ? (
                <span>canonical content-impression baseline</span>
              ) : (
                <span>
                  {pct(step.pctFromPrevious)} vs prev · {pct(step.pctFromFirst)}{" "}
                  vs impressions
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200/80">
              <div
                className="h-full rounded-full bg-primary/75 transition-[width]"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Grouped event-count ratios for two scopes. These are not user conversion. */
function ComparisonGroupedBars({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: AnalyticsFunnelSeries;
  right: AnalyticsFunnelSeries;
  leftLabel: string;
  rightLabel: string;
}) {
  const transitionIndices = [1, 2, 3, 4] as const;
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-500">
        Event-count ratio vs previous metric
      </p>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 shrink-0 rounded-sm bg-primary/75" />
          <span className="truncate">{leftLabel}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 shrink-0 rounded-sm bg-emerald-600/75" />
          <span className="truncate">{rightLabel}</span>
        </span>
      </div>
      <div className="space-y-3">
        {transitionIndices.map((i) => {
          const label = left.steps[i]?.label ?? right.steps[i]?.label ?? "";
          const l = left.steps[i]?.pctFromPrevious ?? 0;
          const r = right.steps[i]?.pctFromPrevious ?? 0;
          const rowMax = Math.max(l, r, 1);
          return (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,8.5rem)_1fr]"
            >
              <div
                className="truncate pt-0.5 text-[10px] leading-tight text-gray-600"
                title={label}
              >
                → {label}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200/80">
                    <div
                      className={cn(
                        "h-full rounded-full bg-primary/75 transition-[width]",
                      )}
                      style={{ width: `${(l / rowMax) * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-gray-600">
                    {pct(l)}
                  </div>
                </div>
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200/80">
                    <div
                      className="h-full rounded-full bg-emerald-600/75 transition-[width]"
                      style={{ width: `${(r / rowMax) * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[10px] tabular-nums text-gray-600">
                    {pct(r)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAnalyticsFunnels({
  filters,
}: {
  filters: AnalyticsOverviewFilters;
}) {
  const [data, setData] = useState<AnalyticsFunnelsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breakdownTab, setBreakdownTab] = useState<
    "entity" | "vertical" | "segment" | "city"
  >("entity");

  const queryKey = useMemo(() => buildQuery(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/analytics/funnels?${queryKey}`, {
          credentials: "include",
        });
        const json = (await res.json()) as AnalyticsFunnelsResult & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            "error" in json && json.error ? json.error : `HTTP ${res.status}`,
          );
        }
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
          setData(null);
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

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
        Loading interaction volumes…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 px-6 py-8 text-center text-sm text-red-800">
        {error ?? "No data"}
      </div>
    );
  }

  const bd = data.breakdowns;
  const maxGlobal = maxStepCount(data.globalFunnel);

  return (
    <div className="space-y-6">
      <Section
        title="Interaction volumes"
        subtitle="First-party UserEvent volumes. Ratios compare event counts and are not sequential user/session conversion; values above 100% are valid. Acquisition/session funnels belong to GA4."
      >
        <FunnelStrip data={data.globalFunnel} maxCount={maxGlobal} />
      </Section>

      <Section
        title="Interaction-volume breakdowns"
        subtitle="Same canonical metrics and filters except the chosen slice"
      >
        <Tabs
          value={breakdownTab}
          onValueChange={(v) =>
            setBreakdownTab(v as typeof breakdownTab)
          }
        >
          <TabsList className="flex h-auto flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="entity" className="text-xs">
              Entity type
            </TabsTrigger>
            <TabsTrigger value="vertical" className="text-xs">
              Vertical
            </TabsTrigger>
            <TabsTrigger value="segment" className="text-xs">
              Segment
            </TabsTrigger>
            <TabsTrigger value="city" className="text-xs">
              City
            </TabsTrigger>
          </TabsList>
          <TabsContent value="entity" className="mt-4 space-y-3">
            {Object.entries(bd.byEntityType).map(([k, funnel]) => (
              <div key={k}>
                <div className="mb-1 text-xs font-medium text-gray-700">
                  {k}
                </div>
                <FunnelStrip data={funnel} maxCount={maxStepCount(funnel)} />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="vertical" className="mt-4 space-y-3">
            {Object.entries(bd.byVertical).map(([k, funnel]) => (
              <div key={k}>
                <div className="mb-1 text-xs font-medium text-gray-700">
                  {k}
                </div>
                <FunnelStrip data={funnel} maxCount={maxStepCount(funnel)} />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="segment" className="mt-4 space-y-3">
            {Object.entries(bd.bySegment).map(([k, funnel]) => (
              <div key={k}>
                <div className="mb-1 text-xs font-medium text-gray-700">
                  {k}
                </div>
                <FunnelStrip data={funnel} maxCount={maxStepCount(funnel)} />
              </div>
            ))}
          </TabsContent>
          <TabsContent value="city" className="mt-4 space-y-3">
            {bd.byCity.length === 0 ? (
              <p className="text-xs text-gray-500">No city-tagged events</p>
            ) : (
              bd.byCity.map((c) => (
                <div key={c.citySlug}>
                  <div className="mb-1 text-xs font-medium text-gray-700">
                    {c.cityName}
                  </div>
                  <FunnelStrip
                    data={c.funnel}
                    maxCount={maxStepCount(c.funnel)}
                  />
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        title="Volume comparison"
        subtitle="Counts and event-count ratios. These comparisons do not imply that the same user moved through every step."
      >
        <div className="space-y-6">
          {data.comparisons.map((cmp) => (
            <div
              key={cmp.id}
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-3"
            >
              <div className="text-xs font-medium text-gray-800">
                {cmp.label}
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {[cmp.left, cmp.right].map((side) => (
                  <div key={side.key}>
                    <div className="text-[11px] font-semibold text-gray-600">
                      {side.label}
                    </div>
                    <table className="mt-2 w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] text-gray-500">
                          <th className="pb-1 font-medium">Metric</th>
                          <th className="pb-1 font-medium text-right">Count</th>
                          <th className="pb-1 font-medium text-right">ratio prev</th>
                        </tr>
                      </thead>
                      <tbody>
                        {side.funnel.steps.map((s, i) => (
                          <tr key={s.key} className="border-t border-gray-100">
                            <td className="py-1 text-gray-600">{s.label}</td>
                            <td className="py-1 text-right tabular-nums text-gray-900">
                              {s.count.toLocaleString()}
                            </td>
                            <td className="py-1 text-right tabular-nums text-gray-500">
                              {i === 0 ? "—" : pct(s.pctFromPrevious)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <ComparisonGroupedBars
                left={cmp.left.funnel}
                right={cmp.right.funnel}
                leftLabel={cmp.left.label}
                rightLabel={cmp.right.label}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Volume-gap analysis"
        subtitle="Largest positive decreases in event volume, followed by entities and verticals with low event-count ratios."
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-800">
              Largest volume decreases
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs">
              {data.dropOff.biggestSteps.map((t) => (
                <li
                  key={`${t.from}-${t.to}`}
                  className="flex flex-wrap justify-between gap-2 rounded-lg bg-amber-50/80 px-2 py-1.5 text-amber-950"
                >
                  <span>
                    {STEP_LABEL(t.from)} → {STEP_LABEL(t.to)}
                  </span>
                  <span className="tabular-nums">
                    −{t.lost.toLocaleString()} events · {pct(t.dropOffPct)}{" "}
                    lower volume
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DropEntityBlock
              title="Impressions → opens (lowest ratio)"
              rows={data.dropOff.byEntity.viewToOpen}
              hint="Low open / impression event-count ratio"
            />
            <DropEntityBlock
              title="Opens → saves (lowest ratio)"
              rows={data.dropOff.byEntity.openToSave}
              hint="Low save / open event-count ratio"
            />
            <DropEntityBlock
              title="Saves → plan (lowest ratio)"
              rows={data.dropOff.byEntity.saveToPlan}
              hint="Low plan / save event-count ratio"
            />
            <DropEntityBlock
              title="Plan → CTA (lowest ratio)"
              rows={data.dropOff.byEntity.planToClick}
              hint="Low CTA / plan event-count ratio"
            />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-800">
              Volume decrease by vertical
            </h3>
            <p className="mt-1 text-[11px] text-gray-500">
              Sorted by strongest positive decrease; this is not sequential
              user drop-off.
            </p>
            <div className="mt-3 space-y-3">
              {data.dropOff.byVertical.map((v) => (
                <div
                  key={v.vertical}
                  className="rounded-lg border border-gray-100 p-2 text-xs"
                >
                  <div className="font-medium text-gray-800">{v.vertical}</div>
                  <ul className="mt-1 space-y-0.5 text-gray-600">
                    {v.transitions.slice(0, 2).map((t) => (
                      <li key={`${v.vertical}-${t.from}-${t.to}`}>
                        {STEP_LABEL(t.from)} → {STEP_LABEL(t.to)}:{" "}
                        {pct(t.dropOffPct)} lower volume
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {loading ? (
        <p className="text-center text-xs text-gray-400">Refreshing…</p>
      ) : null}
    </div>
  );
}

function STEP_LABEL(k: string): string {
  const m: Record<string, string> = {
    view: "Impressions",
    open: "Opens",
    save: "Saves",
    plan: "Plan adds",
    click: "CTA clicks",
  };
  return m[k] ?? k;
}

function DropEntityBlock({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: AnalyticsFunnelWorstEntity[];
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="text-xs font-semibold text-gray-800">{title}</div>
      <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">Not enough volume</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-[11px]">
          {rows.map((r) => (
            <li
              key={`${r.entityType}-${r.entityId}`}
              className="flex flex-col gap-0.5 border-t border-gray-50 pt-1.5 first:border-t-0 first:pt-0"
            >
              <span className="font-medium text-gray-800">{r.title}</span>
              <span className="text-gray-500">
                {r.entityType} · count ratio {pct(r.transitionRate * 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
