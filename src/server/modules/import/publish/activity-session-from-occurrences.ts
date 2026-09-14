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

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ABWS_PARSER_KEY } from "../normalizers/abws-event.normalizer";
import type { EventImportOccurrence } from "../types";

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

export async function upsertActivitySessionsFromOccurrences(
  activityId: string,
  occurrences: EventImportOccurrence[],
): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;

  for (const occurrence of occurrences) {
    const args = buildActivitySessionUpsertArgs(activityId, occurrence);
    if (!args) {
      skipped++;
      continue;
    }
    await prisma.activitySession.upsert(args);
    upserted++;
  }

  return { upserted, skipped };
}
