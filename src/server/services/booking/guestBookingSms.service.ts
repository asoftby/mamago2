import "server-only";

import type { BookingSmsDeliveryStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { buildGuestBookingSms } from "@/lib/booking/guestBookingSms";
import { getLocalDateKey } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { normalizePhoneToE164 } from "@/lib/phone/e164";
import { sendQuickSms } from "@/lib/sms/smsBy";
import { SmsByDeliveryError } from "@/lib/sms/smsByResponse";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 60_000;
const RETRYABLE = ["PENDING", "FAILED"] as const;

const deliverySelect = {
  id: true,
  bookingId: true,
  decisionStatus: true,
  attemptCount: true,
  decisionActivity: { select: { bookingId: true, actorType: true, payload: true } },
  booking: { select: {
    userId: true, status: true, kind: true, customerPhone: true,
    startsAt: true, requestedDate: true, requestedTime: true,
    session: { select: { startsAt: true } },
    offerSession: { select: { startAt: true } },
  } },
} satisfies Prisma.BookingSmsDeliverySelect;

type Delivery = Prisma.BookingSmsDeliveryGetPayload<{ select: typeof deliverySelect }>;

type PreparedSms = { phoneDigits: string; message: string; parts: number };

function prepare(row: Delivery): PreparedSms | string {
  const booking = row.booking;
  if (booking.userId || booking.kind !== "STANDARD") return "NOT_GUEST_STANDARD";
  if (booking.status !== row.decisionStatus) return "DECISION_SUPERSEDED";
  const payload = row.decisionActivity.payload;
  if (row.decisionActivity.bookingId !== row.bookingId || row.decisionActivity.actorType !== "BUSINESS" ||
      !payload || typeof payload !== "object" || Array.isArray(payload) || payload.to !== row.decisionStatus) {
    return "INVALID_DECISION";
  }
  const reason = typeof payload.reason === "string" ? payload.reason : null;
  if (row.decisionStatus !== "CONFIRMED" && !reason?.trim()) return "MISSING_REASON";
  // Deletion/anonymization clears the source phone. Never keep a second recipient copy in the queue.
  const phone = normalizePhoneToE164(booking.customerPhone ?? "");
  if (!phone) return "RECIPIENT_UNAVAILABLE";
  const start = booking.startsAt ?? booking.session?.startsAt ?? booking.offerSession?.startAt;
  const date = start ? getLocalDateKey(start) : booking.requestedDate?.toISOString().slice(0, 10);
  const time = start ? formatHHMM(start) : booking.requestedTime;
  const when = date ? date.slice(8, 10) + "." + date.slice(5, 7) + (time ? " " + time : "") : "";
  const copy = buildGuestBookingSms({ bookingId: row.bookingId, status: row.decisionStatus, when, reason });
  return { phoneDigits: phone.slice(1), ...copy };
}

/** CAS claim and attempt journal commit before any provider call. */
async function claim(id: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.bookingSmsDelivery.findFirst({
      where: { id, status: { in: [...RETRYABLE] }, nextAttemptAt: { lte: now }, attemptCount: { lt: MAX_ATTEMPTS } },
      select: deliverySelect,
    });
    if (!row) return null;
    const prepared = prepare(row);
    const number = row.attemptCount + 1;
    const skipped = typeof prepared === "string";
    const status = skipped ? "SKIPPED" : "SENDING";
    const updated = await tx.bookingSmsDelivery.updateMany({
      where: { id, status: { in: [...RETRYABLE] }, attemptCount: row.attemptCount, nextAttemptAt: { lte: now } },
      data: {
        status, attemptCount: number, errorCode: skipped ? prepared : null,
        estimatedParts: skipped ? null : prepared.parts,
        leaseUntil: skipped ? null : new Date(now.getTime() + LEASE_MS),
      },
    });
    if (updated.count !== 1) return null;
    const attempt = await tx.bookingSmsAttempt.create({
      data: { deliveryId: id, number, status, errorCode: skipped ? prepared : null,
        startedAt: now, finishedAt: skipped ? now : null },
      select: { id: true },
    });
    return { attemptId: attempt.id, number, prepared };
  });
}

async function finish(id: string, number: number, attemptId: string, data: {
  status: BookingSmsDeliveryStatus;
  errorCode?: string;
  providerMessageId?: string;
  providerStatus?: string;
  providerParts?: number | null;
}, now: Date) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingSmsDelivery.updateMany({
      where: { id, attemptCount: number, status: { in: ["SENDING", "UNCERTAIN"] } },
      data: {
        ...data, errorCode: data.errorCode ?? null, leaseUntil: null,
        acceptedAt: data.status === "ACCEPTED" ? now : null,
        nextAttemptAt: new Date(now.getTime() + number * 5 * 60_000),
      },
    });
    if (updated.count !== 1) return;
    await tx.bookingSmsAttempt.update({
      where: { id: attemptId },
      data: { ...data, errorCode: data.errorCode ?? null, status: data.status === "EXHAUSTED" ? "FAILED" : data.status, finishedAt: now },
    });
  });
}

async function quarantineInterrupted(id: string, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.bookingSmsDelivery.updateMany({
      where: { id, status: "SENDING", leaseUntil: { lte: now } },
      data: { status: "UNCERTAIN", errorCode: "WORKER_INTERRUPTED", leaseUntil: null },
    });
    if (changed.count !== 1) return false;
    await tx.bookingSmsAttempt.updateMany({
      where: { deliveryId: id, status: "SENDING" },
      data: { status: "UNCERTAIN", errorCode: "WORKER_INTERRUPTED", finishedAt: now },
    });
    return true;
  });
}

/**
 * Bounded cron drain and immediate after-response delivery share this path.
 * Inject the provider in tests. Accepted/uncertain attempts are never automatically resent.
 */
export async function dispatchGuestBookingSms(
  options: { bookingId?: string; limit?: number } = {},
  dependencies: { send?: typeof sendQuickSms; now?: () => Date } = {},
) {
  const now = dependencies.now ?? (() => new Date());
  const checkedAt = now();
  const rows = await prisma.bookingSmsDelivery.findMany({
    where: {
      ...(options.bookingId ? { bookingId: options.bookingId } : {}),
      OR: [
        { status: { in: [...RETRYABLE] }, nextAttemptAt: { lte: checkedAt } },
        { status: "SENDING", leaseUntil: { lte: checkedAt } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(options.limit ?? 10, 10)),
    select: { id: true, status: true },
  });
  const counts = { accepted: 0, failed: 0, uncertain: 0, skipped: 0 };
  for (const row of rows) {
    if (row.status === "SENDING") {
      if (await quarantineInterrupted(row.id, now())) counts.uncertain += 1;
      continue;
    }
    const claimed = await claim(row.id, now());
    if (!claimed || typeof claimed.prepared === "string") {
      counts.skipped += 1;
      continue;
    }
    let result;
    try {
      result = await (dependencies.send ?? sendQuickSms)({
        phoneDigits: claimed.prepared.phoneDigits, message: claimed.prepared.message,
      });
    } catch (error) {
      const code = error instanceof SmsByDeliveryError ? error.reason : "UNEXPECTED_ERROR";
      const rejected = code === "NOT_CONFIGURED" || code === "PROVIDER_REJECTED";
      const status = rejected ? (claimed.number < MAX_ATTEMPTS ? "FAILED" : "EXHAUSTED") : "UNCERTAIN";
      await finish(row.id, claimed.number, claimed.attemptId, { status, errorCode: code }, now());
      if (rejected) counts.failed += 1;
      else counts.uncertain += 1;
      continue;
    }
    // A DB failure here leaves SENDING. Recovery quarantines it instead of buying another SMS.
    const receipt = {
      providerMessageId: String(result.sms_id ?? result.message_id),
      providerStatus: result.status?.toUpperCase(),
      providerParts: Number.isInteger(result.parts) && result.parts! > 0 ? result.parts : null,
    };
    try {
      await finish(row.id, claimed.number, claimed.attemptId, { status: "ACCEPTED", ...receipt }, now());
    } catch {
      // Retain a non-PII receipt for provider reconciliation if the database is unavailable.
      console.error("[booking-sms] acceptance journal update failed", {
        deliveryId: row.id, attempt: claimed.number, ...receipt,
      });
      throw new Error("Guest SMS acceptance journal update failed");
    }
    counts.accepted += 1;
  }
  return counts;
}
