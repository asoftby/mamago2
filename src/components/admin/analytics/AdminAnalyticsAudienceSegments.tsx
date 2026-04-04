"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import type { AnalyticsSegmentRow } from "@/lib/analytics/analyticsSegmentsTypes";
import { segmentTitle } from "@/lib/analytics/segmentCatalog";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "usersCount"
  | "share"
  | "avgSaves"
  | "avgPlanAdds"
  | "avgCtaClicks"
  | "trend7d"
  | "trend30d";

function formatShare(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function buildQuery(filters: AnalyticsOverviewFilters): string {
  const q = new URLSearchParams();
  q.set("dateRange", filters.dateRange);
  q.set("city", filters.city);
  q.set("entity", filters.entity);
  q.set("vertical", filters.vertical);
  q.set("segment", filters.segment);
  q.set("childAgeBand", filters.childAgeBand);
  return q.toString();
}

export function AdminAnalyticsAudienceSegments({
  filters,
}: {
  filters: AnalyticsOverviewFilters;
}) {
  const [rows, setRows] = useState<AnalyticsSegmentRow[]>([]);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "usersCount",
    dir: "desc",
  });

  const queryKey = useMemo(() => buildQuery(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/analytics/segments?${queryKey}`,
          { credentials: "include" },
        );
        const json = (await res.json()) as
          | { totalProfiles: number; segments: AnalyticsSegmentRow[] }
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            "error" in json && json.error ? json.error : `HTTP ${res.status}`,
          );
        }
        if (!cancelled && "segments" in json) {
          setRows(json.segments);
          setTotalProfiles(json.totalProfiles);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
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

  const sorted = useMemo(() => {
    const copy = [...rows];
    const mult = sort.dir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sort.key === "name") {
        return (
          mult *
          segmentTitle(a.key).localeCompare(segmentTitle(b.key), "en")
        );
      }
      const va =
        sort.key === "share"
          ? a.share
          : sort.key === "usersCount"
            ? a.usersCount
            : sort.key === "avgSaves"
              ? a.avgSaves
              : sort.key === "avgPlanAdds"
                ? a.avgPlanAdds
                : sort.key === "avgCtaClicks"
                  ? a.avgCtaClicks
                  : sort.key === "trend7d"
                    ? a.trend7d
                    : a.trend30d;
      const vb =
        sort.key === "share"
          ? b.share
          : sort.key === "usersCount"
            ? b.usersCount
            : sort.key === "avgSaves"
              ? b.avgSaves
              : sort.key === "avgPlanAdds"
                ? b.avgPlanAdds
                : sort.key === "avgCtaClicks"
                  ? b.avgCtaClicks
                  : sort.key === "trend7d"
                    ? b.trend7d
                    : b.trend30d;
      return mult * (va - vb);
    });
    return copy;
  }, [rows, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading segments…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  const q = buildQuery(filters);

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Profiles in range:{" "}
        <span className="font-medium text-gray-800">
          {totalProfiles.toLocaleString()}
        </span>
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/90">
              <Th
                label="Segment"
                active={sort.key === "name"}
                onClick={() => toggleSort("name")}
              />
              <Th
                label="Users"
                align="right"
                active={sort.key === "usersCount"}
                onClick={() => toggleSort("usersCount")}
              />
              <Th
                label="Share"
                align="right"
                active={sort.key === "share"}
                onClick={() => toggleSort("share")}
              />
              <Th
                label="Avg saves"
                align="right"
                active={sort.key === "avgSaves"}
                onClick={() => toggleSort("avgSaves")}
              />
              <Th
                label="Avg plan"
                align="right"
                active={sort.key === "avgPlanAdds"}
                onClick={() => toggleSort("avgPlanAdds")}
              />
              <Th
                label="Avg CTA"
                align="right"
                active={sort.key === "avgCtaClicks"}
                onClick={() => toggleSort("avgCtaClicks")}
              />
              <Th
                label="7d trend"
                align="right"
                active={sort.key === "trend7d"}
                onClick={() => toggleSort("trend7d")}
              />
              <Th
                label="30d trend"
                align="right"
                active={sort.key === "trend30d"}
                onClick={() => toggleSort("trend30d")}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.key}
                className="border-b border-gray-100 transition-colors hover:bg-gray-50/80"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link
                    href={`/admin/analytics/segments/${encodeURIComponent(row.key)}?${q}`}
                    className="text-primary hover:underline"
                  >
                    {segmentTitle(row.key)}
                  </Link>
                  <div className="mt-0.5 font-mono text-[10px] font-normal text-gray-400">
                    {row.key}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                  {row.usersCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatShare(row.share)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatCompact(row.avgSaves)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatCompact(row.avgPlanAdds)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                  {formatCompact(row.avgCtaClicks)}
                </td>
                <td className="px-4 py-3 text-right">
                  <TrendPill v={row.trend7d} />
                </td>
                <td className="px-4 py-3 text-right">
                  <TrendPill v={row.trend30d} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  align = "left",
  active,
  onClick,
}: {
  label: string;
  align?: "left" | "right";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-gray-100",
          active && "text-gray-900",
        )}
      >
        {label}
        <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
      </button>
    </th>
  );
}

function TrendPill({ v }: { v: number }) {
  const up = v > 0.5;
  const down = v < -0.5;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums text-xs font-medium",
        up && "text-emerald-700",
        down && "text-rose-700",
        !up && !down && "text-gray-600",
      )}
    >
      {up ? <ArrowUp className="size-3.5" /> : null}
      {down ? <ArrowDown className="size-3.5" /> : null}
      {v > 0 ? "+" : ""}
      {v.toFixed(1)}%
    </span>
  );
}
