/**
 * Party booking delivery health — non-sensitive counts only.
 *
 * PartyOutbox.SENT means the event was processed, NOT that every external
 * channel was delivered. NotificationDelivery is the channel-level truth.
 * Ambiguous PENDING must never be automatically retried (duplicate risk).
 */
import { Prisma } from "@prisma/client";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const STALE_PENDING_MINUTES = 10;
const EXHAUSTED_ATTEMPTS = 5;

type PartyDeliveryRow = {
  failed_telegram: bigint;
  stale_pending_telegram: bigint;
};

export function partyDeliverySamples(
  outboxExhausted: number,
  row: PartyDeliveryRow | undefined,
): MetricSampleDraft[] {
  return [
    { metric: "party.outbox_failed_exhausted", value: outboxExhausted },
    { metric: "party.telegram_delivery_failed", value: Number(row?.failed_telegram ?? BigInt(0)) },
    { metric: "party.telegram_pending_stale", value: Number(row?.stale_pending_telegram ?? BigInt(0)) },
  ];
}

export async function collectPartyDeliveryMetrics(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const staleBefore = new Date(ctx.now.getTime() - STALE_PENDING_MINUTES * 60_000);
  const [outboxExhausted, rows] = await Promise.all([
    ctx.prisma.partyOutbox.count({
      where: { status: "FAILED", attempts: { gte: EXHAUSTED_ATTEMPTS } },
    }),
    ctx.prisma.$queryRaw<PartyDeliveryRow[]>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE d.status = 'FAILED')::bigint AS failed_telegram,
        count(*) FILTER (
          WHERE d.status = 'PENDING' AND d."updatedAt" < ${staleBefore}
        )::bigint AS stale_pending_telegram
      FROM "NotificationDelivery" d
      INNER JOIN "Notification" n ON n.id = d."notificationId"
      INNER JOIN "BookingRequest" b ON b.id = n."entityId" AND b.kind = 'PARTY'
      WHERE n."entityType" = 'BOOKING'
        AND d.channel = 'TELEGRAM'
        AND d.status IN ('FAILED', 'PENDING')
    `),
  ]);
  return partyDeliverySamples(outboxExhausted, rows[0]);
}

export const partyDeliveryMetricsCollector: MetricCollector = {
  name: "party_delivery_health",
  intervalSec: 300,
  timeoutMs: 10_000,
  collect: collectPartyDeliveryMetrics,
};
