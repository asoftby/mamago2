/**
 * Business Quality Boost — Ranking Integration Layer
 *
 * Мягкий multiplier на основе booking reputation score бизнеса.
 * Применяется только к discovery feeds (offers, events).
 *
 * НЕ применяется к:
 *   - search results
 *   - SEO pages
 *   - recommendations
 *   - homepage hero
 *
 * ─── Safeguards ───────────────────────────────────────────────────────────────
 *
 *   1. Minimum volume: bookingCount30d >= 5 (иначе boost = 1.0)
 *   2. Capped multiplier: max 1.10 (не 1.25 из репутации — осторожный старт)
 *   3. No exponential: линейная интерполяция, не степенная
 *   4. No public exposure: score никогда не передаётся клиенту
 *   5. No domination: boost — один из нескольких сигналов, не единственный
 *
 * ─── Max impact ───────────────────────────────────────────────────────────────
 *
 *   score 100 → multiplier 1.10 → +10% к engagementScore
 *   score 50  → multiplier 1.05 → +5%
 *   score 0   → multiplier 1.00 → нейтральный
 *
 * ─── Batch design ─────────────────────────────────────────────────────────────
 *
 *   Один запрос на все businessIds — не N запросов.
 *   Используется в feed-функциях, которые уже имеют пул кандидатов.
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Минимум заявок за 30 дней для применения boost */
const MIN_BOOKING_VOLUME = 5;

/** Максимальный multiplier (cap) */
const MAX_BOOST_MULTIPLIER = 1.10;

/** Период для метрик */
const PERIOD_DAYS = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QualityBoostDebugInfo {
  businessId: string;
  bookingCount: number;
  score: number | null;
  multiplier: number;
  hasEnoughData: boolean;
}

// ─── Score calculation (mirrors bookingReputation.service, no DB call) ────────

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

function calcQualityScore(metrics: {
  bookingCount: number;
  avgResponseMinutes: number | null;
  confirmedRate: number;
  completedRate: number;
}): number | null {
  if (metrics.bookingCount < MIN_BOOKING_VOLUME) return null;

  const responseScore  = calcResponseScore(metrics.avgResponseMinutes);
  const confirmedScore = Math.round((metrics.confirmedRate / 100) * 35);
  const completedScore = Math.round((metrics.completedRate / 100) * 20);
  const volumeBonus    = calcVolumeBonus(metrics.bookingCount);

  return Math.min(100, responseScore + confirmedScore + completedScore + volumeBonus);
}

/**
 * Конвертирует score (0–100) в capped multiplier (1.0–MAX_BOOST_MULTIPLIER).
 * Линейная интерполяция.
 */
function scoreToMultiplier(score: number): number {
  const raw = 1.0 + (score / 100) * (MAX_BOOST_MULTIPLIER - 1.0);
  // Cap + round to 3 decimal places
  return Math.round(Math.min(MAX_BOOST_MULTIPLIER, raw) * 1000) / 1000;
}

// ─── Batch query ──────────────────────────────────────────────────────────────

/**
 * Загружает booking-метрики для набора businessIds одним запросом.
 * Возвращает Map<businessId, multiplier>.
 *
 * Multiplier = 1.0 если:
 *   - businessId не найден
 *   - bookingCount < MIN_BOOKING_VOLUME
 *   - нет данных о response time
 */
export async function getBusinessQualityBoostMap(
  businessIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (businessIds.length === 0) return out;

  const since = new Date();
  since.setDate(since.getDate() - PERIOD_DAYS);

  // Single query: aggregate booking metrics per business
  const rows = await prisma.bookingRequest.findMany({
    where: {
      businessId: { in: businessIds },
      createdAt: { gte: since },
    },
    select: {
      businessId: true,
      status: true,
      responseTimeMinutes: true,
    },
  });

  // Group by businessId
  const grouped = new Map<
    string,
    { statuses: BookingStatus[]; responseTimes: number[] }
  >();

  for (const row of rows) {
    const entry = grouped.get(row.businessId) ?? { statuses: [], responseTimes: [] };
    entry.statuses.push(row.status);
    if (row.responseTimeMinutes !== null) {
      entry.responseTimes.push(row.responseTimeMinutes);
    }
    grouped.set(row.businessId, entry);
  }

  // Compute multiplier per business
  const debugInfos: QualityBoostDebugInfo[] = [];

  for (const businessId of businessIds) {
    const entry = grouped.get(businessId);

    if (!entry || entry.statuses.length < MIN_BOOKING_VOLUME) {
      out.set(businessId, 1.0);

      if (process.env.NODE_ENV === "development") {
        debugInfos.push({
          businessId,
          bookingCount: entry?.statuses.length ?? 0,
          score: null,
          multiplier: 1.0,
          hasEnoughData: false,
        });
      }
      continue;
    }

    const total = entry.statuses.length;
    const confirmedOrCompleted = entry.statuses.filter(
      (s) => s === BookingStatus.CONFIRMED || s === BookingStatus.COMPLETED,
    ).length;
    const completedCount = entry.statuses.filter(
      (s) => s === BookingStatus.COMPLETED,
    ).length;

    const confirmedRate = Math.round((confirmedOrCompleted / total) * 100);
    const completedRate = Math.round((completedCount / total) * 100);
    const avgResponseMinutes =
      entry.responseTimes.length > 0
        ? Math.round(
            entry.responseTimes.reduce((sum, v) => sum + v, 0) /
              entry.responseTimes.length,
          )
        : null;

    const score = calcQualityScore({
      bookingCount: total,
      avgResponseMinutes,
      confirmedRate,
      completedRate,
    });

    const multiplier = score !== null ? scoreToMultiplier(score) : 1.0;
    out.set(businessId, multiplier);

    if (process.env.NODE_ENV === "development") {
      debugInfos.push({
        businessId,
        bookingCount: total,
        score,
        multiplier,
        hasEnoughData: true,
      });
    }
  }

  // Dev debug log
  if (process.env.NODE_ENV === "development" && debugInfos.some((d) => d.multiplier > 1.0)) {
    const active = debugInfos.filter((d) => d.multiplier > 1.0);
    console.debug(
      `[QualityBoost] ${active.length}/${businessIds.length} businesses with boost:`,
      active.map((d) => `${d.businessId.slice(-6)} score=${d.score} ×${d.multiplier}`),
    );
  }

  return out;
}

// ─── Apply helper ─────────────────────────────────────────────────────────────

/**
 * Применяет quality boost к базовому score.
 *
 * Используется в feed-сортировке:
 *   const finalScore = applyBusinessQualityBoost(baseEngagementScore, multiplier);
 *
 * Safeguards:
 *   - multiplier capped at MAX_BOOST_MULTIPLIER (1.10)
 *   - multiplier floor at 1.0 (no penalty)
 *   - integer result (engagement scores are integers)
 *
 * @param baseScore    Текущий engagement score (может быть 0)
 * @param multiplier   Из getBusinessQualityBoostMap (1.0–1.10)
 * @returns            Скорректированный score
 */
export function applyBusinessQualityBoost(
  baseScore: number,
  multiplier: number,
): number {
  // Safeguard: clamp multiplier
  const safeMultiplier = Math.min(MAX_BOOST_MULTIPLIER, Math.max(1.0, multiplier));

  if (safeMultiplier === 1.0) return baseScore;

  // For zero base scores: add a small flat bonus so quality businesses
  // aren't stuck at 0 when they have no engagement yet.
  // Flat bonus = (multiplier - 1.0) * 10 → max +1 point at 1.10
  const effective = baseScore > 0
    ? Math.round(baseScore * safeMultiplier)
    : Math.round((safeMultiplier - 1.0) * 10);

  return effective;
}
