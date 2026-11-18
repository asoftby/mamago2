/**
 * Booking Stale Service
 *
 * Определяет "умирающие" заявки и отправляет lightweight reminder-уведомления.
 *
 * ─── Stale conditions ────────────────────────────────────────────────────────
 *
 *   BOOKING_STALE:
 *     status = NEW AND createdAt < now - 24h
 *     → "Новая заявка ждёт ответа уже N часов"
 *
 *   BOOKING_NEEDS_ATTENTION:
 *     status = CONFIRMED AND lastActivityAt < now - 72h
 *     → "Подтверждённая заявка без активности N дней"
 *
 * ─── Deduplication ───────────────────────────────────────────────────────────
 *
 *   Максимум 1 reminder каждые 24ч на booking.
 *   Проверяем: есть ли уведомление типа BOOKING_STALE/BOOKING_NEEDS_ATTENTION
 *   с entityId = bookingId, созданное < 24ч назад.
 *
 * ─── Trigger ─────────────────────────────────────────────────────────────────
 *
 *   Lazy check — вызывается при открытии страницы заявок.
 *   Не cron, не background worker.
 *   Fire-and-forget из API route.
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { createNotification } from "@/server/services/notification.service";
import { buildPrivateBusinessBookingReminder } from "@/server/services/booking/businessBookingNotificationPrivacy";

// ─── Constants ────────────────────────────────────────────────────────────────

/** NEW без ответа дольше этого → STALE */
const STALE_NEW_HOURS = 24;

/** CONFIRMED без активности дольше этого → NEEDS_ATTENTION */
const STALE_CONFIRMED_HOURS = 72;

/** Минимальный интервал между reminder-уведомлениями на одну заявку */
const DEDUP_WINDOW_HOURS = 24;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StaleBooking {
  id: string;
  status: BookingStatus;
  /** Часов с момента создания (для NEW) или с lastActivityAt (для CONFIRMED) */
  staleHours: number;
  staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION";
}

export interface StaleCheckResult {
  checked: number;
  notified: number;
  skippedDedup: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

function diffHours(from: Date, to: Date = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / 3_600_000);
}

// ─── Stale detection ──────────────────────────────────────────────────────────

/**
 * Возвращает stale заявки для бизнеса.
 * Используется для UI-лейблов и аналитики.
 */
export async function getStaleBookings(businessId: string): Promise<StaleBooking[]> {
  const staleNewCutoff       = hoursAgo(STALE_NEW_HOURS);
  const staleConfirmedCutoff = hoursAgo(STALE_CONFIRMED_HOURS);

  const rows = await prisma.bookingRequest.findMany({
    where: {
      businessId,
      kind: "STANDARD",
      OR: [
        // NEW без ответа > 24ч
        {
          status: BookingStatus.NEW,
          createdAt: { lt: staleNewCutoff },
        },
        // CONFIRMED без активности > 72ч
        {
          status: BookingStatus.CONFIRMED,
          lastActivityAt: { lt: staleConfirmedCutoff },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      lastActivityAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 50, // safety cap
  });

  return rows.map((r) => {
    const isNew = r.status === BookingStatus.NEW;
    const staleHours = isNew
      ? diffHours(r.createdAt)
      : diffHours(r.lastActivityAt);

    return {
      id: r.id,
      status: r.status,
      staleHours,
      staleType: isNew ? "BOOKING_STALE" : "BOOKING_NEEDS_ATTENTION",
    };
  });
}

// ─── Deduplication check ──────────────────────────────────────────────────────

/**
 * Проверяет, было ли уже отправлено reminder-уведомление
 * для этой заявки в последние DEDUP_WINDOW_HOURS часов.
 */
async function wasRecentlyNotified(
  ownerUserId: string,
  bookingId: string,
): Promise<boolean> {
  const since = hoursAgo(DEDUP_WINDOW_HOURS);

  const existing = await prisma.notification.findFirst({
    where: {
      userId: ownerUserId,
      entityType: "BOOKING",
      entityId: bookingId,
      type: { in: ["BOOKING_STALE", "BOOKING_NEEDS_ATTENTION"] },
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  return existing !== null;
}

// ─── Main: check and notify ───────────────────────────────────────────────────

/**
 * Проверяет stale заявки бизнеса и отправляет reminder-уведомления.
 * Вызывается lazy при открытии страницы заявок.
 * Fire-and-forget — не бросает исключения.
 */
export async function checkAndNotifyStaleBookings(
  businessId: string,
  ownerUserId: string,
): Promise<StaleCheckResult> {
  const stale = await getStaleBookings(businessId);

  let notified = 0;
  let skippedDedup = 0;

  for (const booking of stale) {
    const alreadyNotified = await wasRecentlyNotified(ownerUserId, booking.id);

    if (alreadyNotified) {
      skippedDedup++;
      continue;
    }

    const body = buildPrivateBusinessBookingReminder(booking.staleType, booking.staleHours);
    const title =
      booking.staleType === "BOOKING_STALE"
        ? "Заявка ждёт ответа"
        : "Требует внимания";

    await createNotification({
      userId: ownerUserId,
      audience: "BUSINESS",
      type: booking.staleType,
      title,
      body,
      entityType: "BOOKING",
      entityId: booking.id,
      ctaLabel: "Открыть заявки",
      ctaAction: "/business/bookings",
    });

    notified++;
  }

  return { checked: stale.length, notified, skippedDedup };
}

/**
 * Fire-and-forget обёртка — не бросает исключения.
 */
export function checkAndNotifyStaleBookingsSilent(
  businessId: string,
  ownerUserId: string,
): void {
  checkAndNotifyStaleBookings(businessId, ownerUserId).catch((err) =>
    console.error("[BookingStale] check failed:", err),
  );
}
