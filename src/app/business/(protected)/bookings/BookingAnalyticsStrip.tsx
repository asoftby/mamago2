"use client";

import { useEffect, useState } from "react";
import { Zap, TrendingUp, BellDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingAnalytics, TrustSignalType } from "@/server/services/booking/bookingAnalytics.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtResponseTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

// ─── Trust signal chip ────────────────────────────────────────────────────────

const SIGNAL_ICON: Record<TrustSignalType, React.ReactNode> = {
  FAST_RESPONSE: <Zap className="h-3 w-3" />,
  HIGH_CONVERSION: <TrendingUp className="h-3 w-3" />,
};

const SIGNAL_CLASS: Record<TrustSignalType, string> = {
  FAST_RESPONSE:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  HIGH_CONVERSION:
    "border-blue-200 bg-blue-50 text-blue-700",
};

function TrustSignalChip({ type, label }: { type: TrustSignalType; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        SIGNAL_CLASS[type],
      )}
    >
      {SIGNAL_ICON[type]}
      {label}
    </span>
  );
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] text-stone-400 whitespace-nowrap">{label}</span>
      <span
        className={cn(
          "text-[15px] font-bold leading-none tabular-nums",
          highlight ? "text-[#EF8759]" : "text-stone-800",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-stone-200 bg-white px-5 py-4">
      {[80, 64, 72, 68].map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className={`h-2.5 w-${w === 80 ? 16 : w === 64 ? 12 : 14} animate-pulse rounded bg-stone-100`} />
          <div className="h-4 w-8 animate-pulse rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingAnalyticsStrip() {
  const [data, setData] = useState<BookingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/bookings/analytics", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: BookingAnalytics | null) => {
        if (json) setData(json);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AnalyticsSkeleton />;
  if (!data) return null;

  const hasSignals = data.trustSignals.length > 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
      {/* ── Metrics row ── */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <StatCell
          label="Новых сегодня"
          value={String(data.todayNew)}
          highlight={data.todayNew > 0}
        />

        <div className="h-8 w-px bg-stone-100 self-center hidden sm:block" />

        <StatCell
          label="Среднее время ответа"
          value={fmtResponseTime(data.avgResponseMinutes)}
        />

        <div className="h-8 w-px bg-stone-100 self-center hidden sm:block" />

        <StatCell
          label="Подтверждено"
          value={`${data.confirmedRate}%`}
        />

        <div className="h-8 w-px bg-stone-100 self-center hidden sm:block" />

        <StatCell
          label="Завершено"
          value={`${data.completedRate}%`}
        />

        {/* Stale count — shown only when > 0 */}
        {data.staleBookingsCount > 0 && (
          <>
            <div className="h-8 w-px bg-stone-100 self-center hidden sm:block" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] text-stone-400 whitespace-nowrap">Требуют внимания</span>
              <span className="inline-flex items-center gap-1 text-[15px] font-bold leading-none tabular-nums text-violet-700">
                <BellDot className="h-3.5 w-3.5" />
                {data.staleBookingsCount}
              </span>
            </div>
          </>
        )}

        {/* Trust signals — right-aligned on desktop */}
        {hasSignals && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {data.trustSignals.map((s) => (
              <TrustSignalChip key={s.type} type={s.type} label={s.label} />
            ))}
          </div>
        )}
      </div>

      {/* ── Period label ── */}
      <p className="mt-2 text-[11px] text-stone-400">
        За последние {data.periodDays} дней
      </p>
    </div>
  );
}
