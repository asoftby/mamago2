"use client";

import { useEffect, useState } from "react";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";

type Status = { fixedAt: string | null; rangeIncludesPreFixData: boolean };

function formatFixDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * A4: плашка для периодов, захватывающих время до перевода DETAIL_OPEN на
 * клиент с фильтром ботов. Старые данные не удаляются, только помечаются.
 */
export function AdminAnalyticsTrackingFixNotice({ dateRange }: { dateRange: AnalyticsOverviewDateRange }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/analytics/tracking-status?dateRange=${encodeURIComponent(dateRange)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  if (!status?.rangeIncludesPreFixData) return null;

  return (
    <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {status.fixedAt
        ? `Период захватывает данные до исправления трекинга (${formatFixDate(status.fixedAt)}): открытия до этой даты завышены ботами.`
        : "Период захватывает данные до исправления трекинга: открытия завышены ботами."}
    </div>
  );
}
