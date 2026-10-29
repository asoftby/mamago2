/**
 * Read-only #865 health classification. PartyOutbox SENT means in-app/outbox
 * processing completed; it is never proof of downstream Telegram delivery.
 * No notification IDs, contact data, content or error messages are returned.
 */
export const PARTY_DELIVERY_THRESHOLDS = {
  outboxMaxAttempts: 5,
  ambiguousPendingMinutes: 15,
  failedLookbackHours: 24,
} as const;

export type PartyDeliveryCounts = {
  outboxSent24h: number;
  outboxFailedExhausted: number;
  outboxFailedRetryable: number;
  telegramFailed24h: number;
  telegramPendingStale: number;
};

export function summarizePartyDeliveryHealth(counts: PartyDeliveryCounts, now = new Date()) {
  const alertable = counts.outboxFailedExhausted > 0 ||
    counts.telegramFailed24h > 0 || counts.telegramPendingStale > 0;

  return {
    status: alertable ? "DEGRADED" as const : "NO_ACTIVE_ALERT" as const,
    checkedAt: now.toISOString(),
    thresholds: PARTY_DELIVERY_THRESHOLDS,
    counts: { ...counts },
    alerts: {
      outboxExhausted: counts.outboxFailedExhausted > 0,
      telegramFailed24h: counts.telegramFailed24h > 0,
      telegramPendingStale: counts.telegramPendingStale > 0,
    },
    semantics: {
      outboxSent: "EVENT_PROCESSED_NOT_CHANNEL_DELIVERED" as const,
      telegramPending: "AMBIGUOUS_DO_NOT_AUTOMATICALLY_RESEND" as const,
      telegramFailed: "MANUAL_RECONCILIATION_REQUIRED" as const,
    },
  };
}
