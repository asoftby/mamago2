/**
 * ActivitySession from occurrences[]
 *
 * Sources with several sessions per record (ABWS) carry each session in
 * `normalized.occurrences[]` (see types/index.ts). The publish layer never
 * created ActivitySession rows for any source before this — Activity got a
 * best-effort `scheduleJson`/`nextOccurrenceAt` from event-field-mapper.ts,
 * never real per-session rows, so the ABWS schedule and "Купить" button
 * (session.buyUrl) had nothing to render from.
 *
 * Additive and source-scoped: only called when `normalized.occurrences` is
 * present (ABWS today); every other source is unaffected — this file isn't
 * even imported from a code path that runs for them.
 */

import type { ImportFieldLockMode, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { acquireActivityScheduleLock } from "../services/activity-schedule-lock";
import { ABWS_PARSER_KEY } from "../normalizers/abws-event.normalizer";
import type { EventImportOccurrence } from "../types";

type SourceOccurrence = EventImportOccurrence & {
  withdrawnAt?: string | null;
};

/**
 * Manual ownership of scheduleJson must also own ActivitySession rows.
 * Otherwise a later re-apply of the same imported record would recreate the
 * source sessions after an editor changed the schedule in the wizard.
 */
export function shouldApplyImportedScheduleSessions(
  lockMode: ImportFieldLockMode | null | undefined,
): boolean {
  return lockMode !== "PREFER_MANUAL" && lockMode !== "LOCKED";
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Pure mapping: one occurrence -> the args for a single
 * `prisma.activitySession.upsert(...)` call, keyed on the
 * `@@unique([source, externalId])` constraint — safe to call again for the
 * same ImportedRecord (re-apply, or a later UPDATE) without duplicating rows.
 *
 * `withdrawnAt` is deliberately part of both CREATE and UPDATE: a session can
 * disappear and later reappear in ABWS, so a fresh active snapshot must be
 * able to clear a previously stored withdrawal mark.
 *
 * Returns `null` for an occurrence missing `startAt` or `externalId` — can't
 * upsert without the identity key or the one NOT NULL scalar — so the caller
 * can skip it rather than fail the whole publish.
 */
export function buildActivitySessionUpsertArgs(
  activityId: string,
  occurrence: EventImportOccurrence,
): Prisma.ActivitySessionUpsertArgs | null {
  const sourceOccurrence = occurrence as SourceOccurrence;
  const startsAt = sourceOccurrence.startAt ? new Date(sourceOccurrence.startAt) : null;
  if (!sourceOccurrence.externalId || !startsAt || isNaN(startsAt.getTime())) {
    return null;
  }

  const shared = {
    startsAt,
    buyUrl: sourceOccurrence.buyUrl ?? null,
    priceMinCents: sourceOccurrence.priceMinCents ?? null,
    priceMaxCents: sourceOccurrence.priceMaxCents ?? null,
    isSaleOpen: sourceOccurrence.isSaleOpen ?? null,
    withdrawnAt: parseOptionalDate(sourceOccurrence.withdrawnAt),
  };

  return {
    where: {
      source_externalId: { source: ABWS_PARSER_KEY, externalId: sourceOccurrence.externalId },
    },
    create: {
      activity: { connect: { id: activityId } },
      source: ABWS_PARSER_KEY,
      externalId: sourceOccurrence.externalId,
      ...shared,
    },
    update: shared,
  };
}

function getNextActiveOccurrenceAt(
  occurrences: EventImportOccurrence[],
  now: Date,
): Date | null {
  const nowMs = now.getTime();
  const candidates = occurrences
    .map((occurrence) => occurrence as SourceOccurrence)
    .filter((occurrence) => !occurrence.withdrawnAt)
    .map((occurrence) => (occurrence.startAt ? new Date(occurrence.startAt) : null))
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date.getTime()))
    .filter((date) => date.getTime() >= nowMs)
    .sort((a, b) => a.getTime() - b.getTime());

  return candidates[0] ?? null;
}

/**
 * Import session writes and manual takeover are serialized by the same
 * transaction-scoped PostgreSQL advisory lock. This closes the window where
 * an importer could pass the override check and recreate an import-owned row
 * immediately after an editor switched the schedule to manual ownership.
 *
 * ABWS returns a full session snapshot per performance. Reconciliation is
 * therefore authoritative: source-owned rows absent from the current snapshot
 * are marked withdrawn (never hard-deleted), explicit source withdrawals are
 * persisted, and nextOccurrenceAt is recomputed from the nearest future active
 * session. This also clears a stale nextOccurrenceAt when no active future
 * sessions remain.
 */
export async function upsertActivitySessionsFromOccurrences(
  activityId: string,
  occurrences: EventImportOccurrence[],
): Promise<{
  upserted: number;
  skipped: number;
  withdrawnMissing: number;
  blockedByManualOverride: boolean;
}> {
  return prisma.$transaction(async (tx) => {
    await acquireActivityScheduleLock(tx, activityId);

    const override = await tx.importFieldOverride.findUnique({
      where: {
        entityType_entityId_fieldName: {
          entityType: "EVENT",
          entityId: activityId,
          fieldName: "scheduleJson",
        },
      },
      select: { lockMode: true },
    });

    if (!shouldApplyImportedScheduleSessions(override?.lockMode)) {
      console.info("[import-sessions] skipped — schedule is manually owned", {
        activityId,
        lockMode: override?.lockMode,
        occurrencesCount: occurrences.length,
      });
      return {
        upserted: 0,
        skipped: 0,
        withdrawnMissing: 0,
        blockedByManualOverride: true,
      };
    }

    let upserted = 0;
    let skipped = 0;
    const currentExternalIds: string[] = [];

    for (const occurrence of occurrences) {
      if (occurrence.externalId) currentExternalIds.push(occurrence.externalId);
      const args = buildActivitySessionUpsertArgs(activityId, occurrence);
      if (!args) {
        skipped++;
        continue;
      }
      await tx.activitySession.upsert(args);
      upserted++;
    }

    const missingResult = await tx.activitySession.updateMany({
      where: {
        activityId,
        source: ABWS_PARSER_KEY,
        withdrawnAt: null,
        ...(currentExternalIds.length > 0
          ? { externalId: { notIn: currentExternalIds } }
          : {}),
      },
      data: { withdrawnAt: new Date() },
    });

    const nextOccurrenceAt = getNextActiveOccurrenceAt(occurrences, new Date());
    await tx.activity.update({
      where: { id: activityId },
      data: { nextOccurrenceAt },
    });

    return {
      upserted,
      skipped,
      withdrawnMissing: missingResult.count,
      blockedByManualOverride: false,
    };
  });
}
