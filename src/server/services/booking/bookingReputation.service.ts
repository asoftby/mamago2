/**
 * Booking Reputation Service
 *
 * Внутренний quality score бизнеса на основе booking-метрик.
 * НЕ публичный — используется для:
 *   - ranking boost
 *   - admin moderation
 *   - future promotion logic
 *   - internal trust signals
 *
 * Период: последние 30 дней (rolling window).
 * Минимальный объём для score: 5 заявок.
 *
 * ─── Score formula (0–100, прозрачная) ───────────────────────────────────────
 *
 *  Компонент              Вес   Макс
 *  ─────────────────────────────────
 *  Response speed         35    35
 *  Confirmed rate         35    35
 *  Completed rate         20    20
 *  Volume bonus           10    10
 *  ─────────────────────────────────
 *  Total                        100
 *
 *  Response speed (35 pts):
 *    < 15 min  → 35
 *    < 60 min  → 25
 *    < 240 min → 15
 *    < 1440 min→ 5
 *    ≥ 1440 min→ 0
 *    null      → 0
 *
 *  Confirmed rate (35 pts):
 *    linear: rate% / 100 * 35
 *
 *  Completed rate (20 pts):
 *    linear: rate% / 100 * 20
 *
 *  Volume bonus (10 pts):
 *    ≥ 20 bookings → 10
 *    ≥ 10          → 7
 *    ≥ 5           → 4
 *    < 5           → 0 (score = null — insufficient data)
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReputationBadgeType =
  | "FAST_RESPONSE"
  | "CONFIRMS_MOST"
  | "RELIABLE_ORGANIZER"
  | "ACTIVELY_PROCESSING";

export interface ReputationBadge {
  type: ReputationBadgeType;
  label: string;
  /** Иконка-эмодзи для compact display */
  emoji: string;
}

export interface BookingMetrics30d {
  bookingCount: number;
  avgResponseMinutes: number | null;
  confirmedRate: number;
  completedRate: number;
}

export interface BusinessReputation {
  /**
   * Score 0–100. null если недостаточно данных (< 5 заявок за 30 дней).
   * Не показывать публично — только internal.
   */
  score: number | null;
  /** Уровень: null если нет данных */
  tier: ReputationTier | null;
  badges: ReputationBadge[];
  metrics: BookingMetrics30d;
  /** Достаточно ли данных для score */
  hasEnoughData: boolean;
  periodDays: 30;
}

export type ReputationTier = "BRONZE" | "SILVER" | "GOLD";

// ─── Badge definitions ────────────────────────────────────────────────────────

const BADGE_DEFS: Record<
  ReputationBadgeType,
  { label: string; emoji: string }
> = {
  FAST_RESPONSE:       { label: "Быстро отвечает",              emoji: "⚡" },
  CONFIRMS_MOST:       { label: "Подтверждает большинство",     emoji: "✅" },
  RELIABLE_ORGANIZER:  { label: "Надёжный организатор",         emoji: "🏆" },
  ACTIVELY_PROCESSING: { label: "Активно обрабатывает заявки",  emoji: "🔥" },
};

// ─── Score calculation ────────────────────────────────────────────────────────

function calcResponseScore(avgMinutes: number | null): number {
  if (avgMinutes === null) return 0;
  if (avgMinutes < 15)   return 35;
  if (avgMinutes < 60)   return 25;
  if (avgMinutes < 240)  return 15;
  if (avgMinutes < 1440) return 5;
  return 0;
}

function calcVolumeBonus(count: number): number {
  if (count >= 20) return 10;
  if (count >= 10) return 7;
  if (count >= 5)  return 4;
  return 0;
}

function calcScore(metrics: BookingMetrics30d): number {
  const responseScore  = calcResponseScore(metrics.avgResponseMinutes);
  const confirmedScore = Math.round((metrics.confirmedRate / 100) * 35);
  const completedScore = Math.round((metrics.completedRate / 100) * 20);
  const volumeBonus    = calcVolumeBonus(metrics.bookingCount);

  return Math.min(100, responseScore + confirmedScore + completedScore + volumeBonus);
}

function calcTier(score: number): ReputationTier {
  if (score >= 75) return "GOLD";
  if (score >= 45) return "SILVER";
  return "BRONZE";
}

// ─── Badge builder ────────────────────────────────────────────────────────────

const MIN_VOLUME = 5;

function buildBadges(metrics: BookingMetrics30d): ReputationBadge[] {
  if (metrics.bookingCount < MIN_VOLUME) return [];

  const badges: ReputationBadge[] = [];

  // FAST_RESPONSE: avg < 15 min
  if (
    metrics.avgResponseMinutes !== null &&
    metrics.avgResponseMinutes < 15
  ) {
    badges.push({ type: "FAST_RESPONSE", ...BADGE_DEFS.FAST_RESPONSE });
  }

  // CONFIRMS_MOST: confirmed rate ≥ 70%
  if (metrics.confirmedRate >= 70) {
    badges.push({ type: "CONFIRMS_MOST", ...BADGE_DEFS.CONFIRMS_MOST });
  }

  // RELIABLE_ORGANIZER: completed rate ≥ 40% AND confirmed rate ≥ 60%
  if (metrics.completedRate >= 40 && metrics.confirmedRate >= 60) {
    badges.push({ type: "RELIABLE_ORGANIZER", ...BADGE_DEFS.RELIABLE_ORGANIZER });
  }

  // ACTIVELY_PROCESSING: ≥ 10 bookings in 30 days
  if (metrics.bookingCount >= 10) {
    badges.push({ type: "ACTIVELY_PROCESSING", ...BADGE_DEFS.ACTIVELY_PROCESSING });
  }

  return badges;
}

// ─── Main query ───────────────────────────────────────────────────────────────

export async function getBusinessReputation(
  businessId: string,
): Promise<BusinessReputation> {
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);

  const rows = await prisma.bookingRequest.findMany({
    where: {
      businessId,
      createdAt: { gte: since30 },
    },
    select: {
      status: true,
      responseTimeMinutes: true,
    },
  });

  const total = rows.length;
  const hasEnoughData = total >= MIN_VOLUME;

  // ── Rates ──
  const confirmedOrCompleted = rows.filter(
    (r) =>
      r.status === BookingStatus.CONFIRMED ||
      r.status === BookingStatus.COMPLETED,
  ).length;

  const completedCount = rows.filter(
    (r) => r.status === BookingStatus.COMPLETED,
  ).length;

  const confirmedRate =
    total > 0 ? Math.round((confirmedOrCompleted / total) * 100) : 0;
  const completedRate =
    total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // ── Avg response time ──
  const responseTimes = rows
    .map((r) => r.responseTimeMinutes)
    .filter((v): v is number => v !== null && v !== undefined);

  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length,
        )
      : null;

  const metrics: BookingMetrics30d = {
    bookingCount: total,
    avgResponseMinutes,
    confirmedRate,
    completedRate,
  };

  // ── Score + tier ──
  const score = hasEnoughData ? calcScore(metrics) : null;
  const tier = score !== null ? calcTier(score) : null;

  // ── Badges ──
  const badges = buildBadges(metrics);

  return {
    score,
    tier,
    badges,
    metrics,
    hasEnoughData,
    periodDays: 30,
  };
}

// ─── Ranking integration helper ───────────────────────────────────────────────

/**
 * Возвращает boost-множитель для ранжирования (1.0 = нейтральный).
 *
 * Использование (будущее):
 *   const boost = await getBusinessBookingQualityBoost(businessId);
 *   finalScore = baseScore * boost;
 *
 * Пока НЕ подключён к поиску/выдаче — только foundation.
 *
 * Диапазон: 1.0 – 1.25
 */
export async function getBusinessBookingQualityBoost(
  businessId: string,
): Promise<number> {
  const rep = await getBusinessReputation(businessId);

  if (!rep.hasEnoughData || rep.score === null) return 1.0;

  // Linear interpolation: score 0 → 1.0, score 100 → 1.25
  const boost = 1.0 + (rep.score / 100) * 0.25;
  return Math.round(boost * 1000) / 1000; // 3 decimal places
}
