/**
 * Signal reconciliation engine (§21 Step 3, Phases B/L).
 *
 * `Detector.evaluate()` returns the COMPLETE current set of problems for
 * that detector. This reconciles that set against the detector's live
 * (unresolved) OperationalSignal rows:
 *
 *   HIT  = fingerprint present in the current evaluation.
 *   MISS = an existing live fingerprint for this detector absent from the
 *          current evaluation.
 *
 * Only ever called on a successful (OK) DetectorRun — FAILED/TIMEOUT/
 * SKIPPED_LOCKED must never reach this (enforced structurally: the
 * executor's persistResult seam is only invoked on the success path).
 *
 * All incident-transition timestamps (firstSeenAt/lastSeenAt/openedAt/
 * attentionChangedAt/resolvedAt) use a single DB `clock_timestamp()`
 * obtained once per reconciliation transaction — never process `new Date()`.
 */
import { Prisma, type OperationalSignal, type PrismaClient } from "@prisma/client";

import { DEFAULT_HYSTERESIS, type DetectorHysteresis, type SignalDraft } from "./types";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION;
}

export interface ReconciliationCounts {
  signalsOpened: number;
  signalsResolved: number;
}

type Tx = Prisma.TransactionClient;

async function txNow(tx: Tx): Promise<Date> {
  const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return rows[0].now;
}

function applySeverityMutation(
  existing: OperationalSignal,
  nextSeverity: "CRITICAL" | "WARNING",
  now: Date,
): {
  severity: "CRITICAL" | "WARNING";
  attentionChangedAt: Date;
  acknowledgedAt: null | undefined;
  acknowledgedBy: null | undefined;
  snoozedUntil: null | undefined;
} {
  if (nextSeverity === existing.severity) {
    return {
      severity: existing.severity,
      attentionChangedAt: existing.attentionChangedAt ?? now,
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
      snoozedUntil: undefined,
    };
  }

  if (nextSeverity === "CRITICAL") {
    // WARNING -> CRITICAL: re-demands attention, clears ack/snooze. openedAt untouched.
    return {
      severity: "CRITICAL",
      attentionChangedAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      snoozedUntil: null,
    };
  }

  // CRITICAL -> WARNING: attentionChangedAt and ack/snooze are preserved.
  return {
    severity: "WARNING",
    attentionChangedAt: existing.attentionChangedAt ?? now,
    acknowledgedAt: undefined,
    acknowledgedBy: undefined,
    snoozedUntil: undefined,
  };
}

async function handleHit(tx: Tx, detector: string, signal: SignalDraft, existing: OperationalSignal | undefined, now: Date, hysteresis: DetectorHysteresis): Promise<{ opened: boolean }> {
  if (!existing) {
    try {
      await tx.operationalSignal.create({
        data: {
          fingerprint: signal.fingerprint,
          detector,
          type: signal.type,
          status: "PENDING",
          severity: signal.severity,
          title: signal.title,
          summary: signal.summary,
          detailsUrl: signal.detailsUrl,
          entityType: signal.entityType,
          entityId: signal.entityId,
          payload: signal.payload === undefined ? Prisma.JsonNull : (signal.payload as Prisma.InputJsonValue),
          consecutiveHits: 1,
          consecutiveMisses: 0,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        // Overlapping worker already created this fingerprint just now —
        // idempotent no-op; the next reconciliation cycle picks it up as
        // an existing row.
        return { opened: false };
      }
      throw err;
    }
    return { opened: false };
  }

  const descriptiveFields = {
    type: signal.type,
    title: signal.title,
    summary: signal.summary,
    detailsUrl: signal.detailsUrl,
    entityType: signal.entityType,
    entityId: signal.entityId,
    payload: signal.payload === undefined ? Prisma.JsonNull : (signal.payload as Prisma.InputJsonValue),
  };

  if (existing.status === "PENDING") {
    const consecutiveHits = existing.consecutiveHits + 1;
    if (consecutiveHits >= hysteresis.open) {
      await tx.operationalSignal.update({
        where: { id: existing.id },
        data: {
          ...descriptiveFields,
          severity: signal.severity,
          status: "OPEN",
          consecutiveHits,
          consecutiveMisses: 0,
          lastSeenAt: now,
          openedAt: now,
          attentionChangedAt: now,
        },
      });
      return { opened: true };
    }
    await tx.operationalSignal.update({
      where: { id: existing.id },
      data: { ...descriptiveFields, severity: signal.severity, consecutiveHits, lastSeenAt: now },
    });
    return { opened: false };
  }

  // existing.status === "OPEN"
  const severityMutation = applySeverityMutation(existing, signal.severity, now);
  await tx.operationalSignal.update({
    where: { id: existing.id },
    data: {
      ...descriptiveFields,
      ...severityMutation,
      consecutiveHits: existing.consecutiveHits + 1,
      consecutiveMisses: 0,
      lastSeenAt: now,
    },
  });
  return { opened: false };
}

async function handleMiss(tx: Tx, existing: OperationalSignal, now: Date, hysteresis: DetectorHysteresis): Promise<{ resolved: boolean }> {
  if (existing.status === "PENDING") {
    await tx.operationalSignal.update({
      where: { id: existing.id },
      data: { status: "ABORTED", resolution: "ABORTED", resolvedAt: now },
    });
    return { resolved: false };
  }

  // existing.status === "OPEN"
  const consecutiveMisses = existing.consecutiveMisses + 1;
  if (consecutiveMisses >= hysteresis.close) {
    await tx.operationalSignal.update({
      where: { id: existing.id },
      data: { status: "RESOLVED", resolution: "AUTO", resolvedAt: now },
    });
    return { resolved: true };
  }

  await tx.operationalSignal.update({
    where: { id: existing.id },
    data: { consecutiveMisses, consecutiveHits: 0 },
  });
  return { resolved: false };
}

/**
 * Reconciles one detector's complete current problem set against its live
 * signals. Runs in a single transaction with one DB `now`.
 */
export async function reconcileDetectorSignals(
  prisma: PrismaClient,
  detector: string,
  currentSignals: SignalDraft[],
  hysteresis: DetectorHysteresis = DEFAULT_HYSTERESIS,
): Promise<ReconciliationCounts> {
  if (!(hysteresis.close > hysteresis.open)) {
    throw new Error(`Invalid hysteresis for detector "${detector}": close must be > open`);
  }

  return prisma.$transaction(async (tx) => {
    const now = await txNow(tx);

    const liveRows = await tx.operationalSignal.findMany({
      where: { detector, resolvedAt: null },
    });
    const liveByFingerprint = new Map(liveRows.map((row) => [row.fingerprint, row]));
    const currentFingerprints = new Set(currentSignals.map((s) => s.fingerprint));

    let signalsOpened = 0;
    let signalsResolved = 0;

    for (const signal of currentSignals) {
      const existing = liveByFingerprint.get(signal.fingerprint);
      const { opened } = await handleHit(tx, detector, signal, existing, now, hysteresis);
      if (opened) signalsOpened += 1;
    }

    for (const row of liveRows) {
      if (currentFingerprints.has(row.fingerprint)) continue;
      const { resolved } = await handleMiss(tx, row, now, hysteresis);
      if (resolved) signalsResolved += 1;
    }

    return { signalsOpened, signalsResolved };
  });
}
