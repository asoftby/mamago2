"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type {
  BusinessReputation,
  ReputationTier,
  ReputationBadgeType,
} from "@/server/services/booking/bookingReputation.service";

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  ReputationTier,
  { label: string; barColor: string; scoreColor: string; borderColor: string; bgColor: string }
> = {
  BRONZE: {
    label: "Бронза",
    barColor: "bg-amber-400",
    scoreColor: "text-amber-700",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50/60",
  },
  SILVER: {
    label: "Серебро",
    barColor: "bg-stone-400",
    scoreColor: "text-stone-600",
    borderColor: "border-stone-200",
    bgColor: "bg-stone-50/60",
  },
  GOLD: {
    label: "Золото",
    barColor: "bg-[#EF8759]",
    scoreColor: "text-[#C65D2E]",
    borderColor: "border-[#EF8759]/30",
    bgColor: "bg-[#EF8759]/5",
  },
};

// ─── Badge chip ───────────────────────────────────────────────────────────────

const BADGE_CHIP_CLASS: Record<ReputationBadgeType, string> = {
  FAST_RESPONSE:       "border-emerald-200 bg-emerald-50 text-emerald-700",
  CONFIRMS_MOST:       "border-blue-200 bg-blue-50 text-blue-700",
  RELIABLE_ORGANIZER:  "border-[#EF8759]/30 bg-[#EF8759]/5 text-[#C65D2E]",
  ACTIVELY_PROCESSING: "border-violet-200 bg-violet-50 text-violet-700",
};

function BadgeChip({
  type,
  label,
  emoji,
}: {
  type: ReputationBadgeType;
  label: string;
  emoji: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium",
        BADGE_CHIP_CLASS[type],
      )}
    >
      <span>{emoji}</span>
      {label}
    </span>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  score,
  tier,
}: {
  score: number;
  tier: ReputationTier;
}) {
  const cfg = TIER_CONFIG[tier];
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className={cn("h-full rounded-full transition-all duration-700", cfg.barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn("w-8 text-right text-[13px] font-bold tabular-nums", cfg.scoreColor)}>
        {score}
      </span>
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-stone-500">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-stone-700">{value}</span>
    </div>
  );
}

function fmtMinutes(m: number | null): string {
  if (m === null) return "—";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}ч ${rem}м` : `${h}ч`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReputationSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-3">
      <div className="h-3 w-24 animate-pulse rounded bg-stone-100" />
      <div className="h-2 w-full animate-pulse rounded-full bg-stone-100" />
      <div className="flex gap-2">
        <div className="h-6 w-28 animate-pulse rounded-full bg-stone-100" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-stone-100" />
      </div>
    </div>
  );
}

// ─── Insufficient data state ──────────────────────────────────────────────────

function InsufficientData({ bookingCount }: { bookingCount: number }) {
  const needed = Math.max(0, 5 - bookingCount);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
        Репутация
      </p>
      <p className="text-[13px] text-stone-500 leading-relaxed">
        {bookingCount === 0
          ? "Получите первые заявки, чтобы начать формировать репутацию."
          : `Ещё ${needed} ${needed === 1 ? "заявка" : needed < 5 ? "заявки" : "заявок"} — и репутация начнёт считаться.`}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-stone-300 transition-all"
          style={{ width: `${Math.min(100, (bookingCount / 5) * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-stone-400">
        {bookingCount} / 5 заявок за 30 дней
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BusinessReputationBlock() {
  const [data, setData] = useState<BusinessReputation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/business/reputation", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: BusinessReputation | null) => {
        if (json) setData(json);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReputationSkeleton />;
  if (!data) return null;

  // Not enough data
  if (!data.hasEnoughData) {
    return <InsufficientData bookingCount={data.metrics.bookingCount} />;
  }

  const score = data.score!;
  const tier = data.tier!;
  const cfg = TIER_CONFIG[tier];

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 space-y-4",
        cfg.borderColor,
        cfg.bgColor,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          Репутация
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            cfg.borderColor,
            cfg.scoreColor,
          )}
        >
          {cfg.label}
        </span>
      </div>

      {/* ── Score bar ── */}
      <ScoreBar score={score} tier={tier} />

      {/* ── Badges ── */}
      {data.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.badges.map((b) => (
            <BadgeChip key={b.type} type={b.type} label={b.label} emoji={b.emoji} />
          ))}
        </div>
      )}

      {/* ── Metrics ── */}
      <div className="space-y-1.5 border-t border-stone-100 pt-3">
        <MetricRow
          label="Заявок за 30 дней"
          value={String(data.metrics.bookingCount)}
        />
        <MetricRow
          label="Среднее время ответа"
          value={fmtMinutes(data.metrics.avgResponseMinutes)}
        />
        <MetricRow
          label="Подтверждено"
          value={`${data.metrics.confirmedRate}%`}
        />
        <MetricRow
          label="Завершено"
          value={`${data.metrics.completedRate}%`}
        />
      </div>

      {/* ── Period label ── */}
      <p className="text-[11px] text-stone-400">За последние {data.periodDays} дней</p>
    </div>
  );
}
