/**
 * Booking Analytics Service
 *
 * Lightweight aggregate queries для бизнес-кабинета.
 * Без materialized views, без cron jobs — чистые SQL aggregates.
 *
 * Период: последние 30 дней (rolling window).
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { getStaleBookings } from "./bookingStale.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingAnalytics {
  /** Новых заявок сегодня */
  todayNew: number;
  /** Среднее время первого ответа в минутах (null если нет данных) */
  avgResponseMinutes: number | null;
  /** Доля подтверждённых + завершённых от всех (0–100) */
  confirmedRate: number;
  /** Доля завершённых от всех (0–100) */
  completedRate: number;
  /** Количество stale заявок (NEW > 24ч или CONFIRMED без активности > 72ч) */
  staleBookingsCount: number;
  /** Trust signals */
  trustSignals: TrustSignal[];
  /** Период аналитики */
  periodDays: 30;
}

export type TrustSignalType = "FAST_RESPONSE" | "HIGH_CONVERSION";

export interface TrustSignal {
  type: TrustSignalType;
  label: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function getBookingAnalytics(
  businessId: string,
): Promise<BookingAnalytics> {
  const now = new Date();

  // Rolling 30-day window
  const since30 = new Date(now);
  since30.setDate(since30.getDate() - 30);

  // Today window
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // ── Run all queries in parallel ──
  const [rows30, todayCount, staleBookings] = await Promise.all([
    // All bookings in last 30 days with relevant fields
    prisma.bookingRequest.findMany({
      where: {
        businessId,
        createdAt: { gte: since30 },
      },
      select: {
        status: true,
        responseTimeMinutes: true,
      },
    }),

    // Today's new bookings
    prisma.bookingRequest.count({
      where: {
        businessId,
        status: BookingStatus.NEW,
        createdAt: { gte: todayStart },
      },
    }),

    // Stale bookings count
    getStaleBookings(businessId),
  ]);

  const total = rows30.length;

  // ── Confirmed rate: (CONFIRMED + COMPLETED) / total ──
  const confirmedOrCompleted = rows30.filter(
    (r) =>
      r.status === BookingStatus.CONFIRMED ||
      r.status === BookingStatus.COMPLETED,
  ).length;

  const confirmedRate =
    total > 0 ? Math.round((confirmedOrCompleted / total) * 100) : 0;

  // ── Completed rate: COMPLETED / total ──
  const completedCount = rows30.filter(
    (r) => r.status === BookingStatus.COMPLETED,
  ).length;

  const completedRate =
    total > 0 ? Math.round((completedCount / total) * 100) : 0;

  // ── Avg response time: mean of responseTimeMinutes where not null ──
  const responseTimes = rows30
    .map((r) => r.responseTimeMinutes)
    .filter((v): v is number => v !== null && v !== undefined);

  const avgResponseMinutes =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length,
        )
      : null;

  // ── Trust signals ──
  const trustSignals = buildTrustSignals({
    avgResponseMinutes,
    completedRate,
    total,
  });

  return {
    todayNew: todayCount,
    avgResponseMinutes,
    confirmedRate,
    completedRate,
    staleBookingsCount: staleBookings.length,
    trustSignals,
    periodDays: 30,
  };
}

// ─── Trust signal builder ─────────────────────────────────────────────────────

function buildTrustSignals({
  avgResponseMinutes,
  completedRate,
  total,
}: {
  avgResponseMinutes: number | null;
  completedRate: number;
  total: number;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];

  // Need at least 3 bookings to show trust signals (avoid noise)
  if (total < 3) return signals;

  // Fast response: avg < 15 min
  if (avgResponseMinutes !== null && avgResponseMinutes < 15) {
    signals.push({ type: "FAST_RESPONSE", label: "Быстро отвечает" });
  }

  // High conversion: completed rate ≥ 40%
  if (completedRate >= 40) {
    signals.push({ type: "HIGH_CONVERSION", label: "Высокая конверсия" });
  }

  return signals;
}
