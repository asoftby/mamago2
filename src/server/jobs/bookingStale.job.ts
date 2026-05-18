/**
 * Booking Stale Scheduled Job
 *
 * Runs periodically to detect and notify about stale bookings.
 * This is the scheduled version of the lazy check in bookingStale.service.ts.
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
 * ─── Execution ───────────────────────────────────────────────────────────────
 *
 *   Recommended: Run every 1 hour
 *   Batch size: 100 bookings per run (safety cap)
 *   Timeout: 30 seconds
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In your cron/scheduler:
 *   import { runBookingStaleNotificationJob } from "@/server/jobs/bookingStale.job";
 *   
 *   // Run every hour
 *   schedule("0 * * * *", () => runBookingStaleNotificationJob());
 */

import prisma from "@/lib/prisma";
import { BookingStatus } from "@prisma/client";
import { createNotification } from "@/server/services/notification.service";

// ─── Constants ────────────────────────────────────────────────────────────────

/** NEW без ответа дольше этого → STALE */
const STALE_NEW_HOURS = 24;

/** CONFIRMED без активности дольше этого → NEEDS_ATTENTION */
const STALE_CONFIRMED_HOURS = 72;

/** Минимальный интервал между reminder-уведомлениями на одну заявку */
const DEDUP_WINDOW_HOURS = 24;

/** Максимум заявок для обработки за один запуск */
const BATCH_SIZE = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingStaleJobResult {
  checked: number;
  notified: number;
  skippedDedup: number;
  errors: number;
  duration: number;
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

// ─── Notification body builder ────────────────────────────────────────────────

function buildStaleBody(
  staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION",
  customerName: string,
  staleHours: number,
): string {
  const h = staleHours;

  if (staleType === "BOOKING_STALE") {
    const label =
      h < 48
        ? `${h} ${pluralHours(h)}`
        : `${Math.floor(h / 24)} ${pluralDays(Math.floor(h / 24))}`;
    return `Новая заявка от ${customerName} ждёт ответа уже ${label}`;
  }

  // BOOKING_NEEDS_ATTENTION
  const days = Math.floor(h / 24);
  const label = `${days} ${pluralDays(days)}`;
  return `Подтверждённая заявка от ${customerName} без активности ${label}`;
}

function pluralHours(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "час";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "часа";
  return "часов";
}

function pluralDays(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return "день";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "дня";
  return "дней";
}

// ─── Main job ─────────────────────────────────────────────────────────────────

/**
 * Main scheduled job: find stale bookings and send notifications.
 * Runs every 1 hour (recommended).
 * Fire-and-forget — doesn't throw exceptions.
 */
export async function runBookingStaleNotificationJob(): Promise<BookingStaleJobResult> {
  const startTime = Date.now();
  const result: BookingStaleJobResult = {
    checked: 0,
    notified: 0,
    skippedDedup: 0,
    errors: 0,
    duration: 0,
  };

  try {
    const staleNewCutoff = hoursAgo(STALE_NEW_HOURS);
    const staleConfirmedCutoff = hoursAgo(STALE_CONFIRMED_HOURS);

    // Find all stale bookings
    const staleBookings = await prisma.bookingRequest.findMany({
      where: {
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
        businessId: true,
        business: { select: { owner: { select: { id: true } } } },
        customerName: true,
        createdAt: true,
        lastActivityAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    result.checked = staleBookings.length;

    // Process each stale booking
    for (const booking of staleBookings) {
      try {
        const ownerUserId = booking.business?.owner?.id;
        if (!ownerUserId) {
          result.errors++;
          continue;
        }

        // Check if already notified
        const alreadyNotified = await wasRecentlyNotified(ownerUserId, booking.id);
        if (alreadyNotified) {
          result.skippedDedup++;
          continue;
        }

        // Determine stale type and calculate hours
        const isNew = booking.status === BookingStatus.NEW;
        const staleHours = isNew
          ? diffHours(booking.createdAt)
          : diffHours(booking.lastActivityAt);

        const staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION" = isNew
          ? "BOOKING_STALE"
          : "BOOKING_NEEDS_ATTENTION";

        const body = buildStaleBody(staleType, booking.customerName, staleHours);
        const title =
          staleType === "BOOKING_STALE"
            ? "Заявка ждёт ответа"
            : "Требует внимания";

        // Create notification
        await createNotification({
          userId: ownerUserId,
          audience: "BUSINESS",
          type: staleType,
          title,
          body,
          entityType: "BOOKING",
          entityId: booking.id,
          ctaLabel: "Открыть заявки",
          ctaAction: "/business/bookings",
        });

        result.notified++;
      } catch (err) {
        console.error("[BookingStaleJob] Error processing booking:", booking.id, err);
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[BookingStaleJob] Job failed:", err);
    result.errors++;
  }

  result.duration = Date.now() - startTime;

  // Log result
  console.log(
    "[BookingStaleJob] Completed:",
    `checked=${result.checked}, notified=${result.notified}, skipped=${result.skippedDedup}, errors=${result.errors}, duration=${result.duration}ms`,
  );

  return result;
}

/**
 * Silent wrapper for scheduled execution.
 * Catches all errors and logs them.
 */
export async function runBookingStaleNotificationJobSilent(): Promise<void> {
  try {
    await runBookingStaleNotificationJob();
  } catch (err) {
    console.error("[BookingStaleJob] Unhandled error:", err);
  }
}
