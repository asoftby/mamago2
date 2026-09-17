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

/**
 * Pure mapping: one occurrence -> the args for a single
 * `prisma.activitySession.upsert(...)` call, keyed on the
 * `@@unique([source, externalId])` constraint — safe to call again for the
 * same ImportedRecord (re-apply, or a later UPDATE decision) without
 * duplicating rows.
 *
 * Returns `null` for an occurrence missing `startAt` or `externalId` — can't
 * upsert without the identity key or the one NOT NULL scalar — so the
 * caller can skip it rather than fail the whole publish (the same
 * "degrade gracefully, don't block" posture as the rest of this pipeline).
 * Kept side-effect-free and exported so the skip/mapping rules are unit
 * tested without a database.
 */
export function buildActivitySessionUpsertArgs(
  activityId: string,
  occurrence: EventImportOccurrence,
): Prisma.ActivitySessionUpsertArgs | null {
  const startsAt = occurrence.startAt ? new Date(occurrence.startAt) : null;
  if (!occurrence.externalId || !startsAt || isNaN(startsAt.getTime())) {
    return null;
  }

  const shared = {
    startsAt,
    buyUrl: occurrence.buyUrl ?? null,
    priceMinCents: occurrence.priceMinCents ?? null,
    priceMaxCents: occurrence.priceMaxCents ?? null,
    isSaleOpen: occurrence.isSaleOpen ?? null,
  };

  return {
    where: {
      source_externalId: { source: ABWS_PARSER_KEY, externalId: occurrence.externalId },
    },
    create: {
      activity: { connect: { id: activityId } },
      source: ABWS_PARSER_KEY,
      externalId: occurrence.externalId,
      ...shared,
    },
    update: shared,
  };
}

/**
 * Import session writes and manual takeover are serialized by the same
 * transaction-scoped PostgreSQL advisory lock. This closes the window where
 * an importer could pass the override check and recreate an import-owned row
 * immediately after an editor switched the schedule to manual ownership.
 */
export async function upsertActivitySessionsFromOccurrences(
  activityId: string,
  occurrences: EventImportOccurrence[],
): Promise<{ upserted: number; skipped: number; blockedByManualOverride: boolean }> {
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
      return { upserted: 0, skipped: 0, blockedByManualOverride: true };
    }

    let upserted = 0;
    let skipped = 0;

    for (const occurrence of occurrences) {
      const args = buildActivitySessionUpsertArgs(activityId, occurrence);
      if (!args) {
        skipped++;
        continue;
      }
      await tx.activitySession.upsert(args);
      upserted++;
    }

    return { upserted, skipped, blockedByManualOverride: false };
  });
}
