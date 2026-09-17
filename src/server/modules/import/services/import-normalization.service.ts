/**
 * ImportNormalizationService
 * raw ImportedRecord → normalizedData + qualityScore
 *
 * Поддерживает PLACE и EVENT.
 * Не делает matching, не делает publish.
 */

import prisma from "@/lib/prisma";
import { normalizePlacePayload } from "../normalizers/place.normalizer";
import { normalizeEventPayload } from "../normalizers/event.normalizer";
import {
  ABWS_PARSER_KEY,
  computeAbwsQualityFlags,
  normalizeAbwsEventPayload,
} from "../normalizers/abws-event.normalizer";
import type { AbwsPerformanceRawPayload } from "../parsers/abws-performances-event.parser";
import { upsertActivitySessionsFromOccurrences } from "../publish/activity-session-from-occurrences";
import { scorePlaceImport, scoreEventImport } from "./import-quality.service";

export interface NormalizeRecordResult {
  recordId: string;
  success: boolean;
  entityType?: string;
  qualityScore?: number;
  warnings?: string[];
  error?: string;
}

/**
 * Нормализовать одну ImportedRecord.
 * Маршрутизирует по entityTypeHint: PLACE → place normalizer, EVENT → event normalizer.
 */
export async function normalizeRecord(recordId: string): Promise<NormalizeRecordResult> {
  const record = await prisma.importedRecord.findUnique({ where: { id: recordId } });

  if (!record) return { recordId, success: false, error: "Record not found" };

  if (!record.rawPayload || typeof record.rawPayload !== "object") {
    await prisma.importedRecord.update({
      where: { id: recordId },
      data: { normalizeStatus: "FAILED", errorMessage: "rawPayload is empty or invalid" },
    });
    return { recordId, success: false, error: "rawPayload is empty or invalid" };
  }

  const entityType = record.entityTypeHint;

  if (entityType === "PLACE") return normalizePlaceRecord(record);
  if (entityType === "EVENT") return normalizeEventRecord(record);

  await prisma.importedRecord.update({
    where: { id: recordId },
    data: { normalizeStatus: "SKIPPED", errorMessage: `Unsupported entityType: ${entityType}` },
  });
  return { recordId, success: false, error: `Unsupported entityType: ${entityType}` };
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

async function normalizePlaceRecord(
  record: { id: string; sourceId: string; rawPayload: unknown; sourceUrl: string | null; externalId: string | null; sourceUpdatedAt: Date | null },
): Promise<NormalizeRecordResult> {
  try {
    const source = await prisma.importSource.findUnique({ where: { id: record.sourceId } });
    if (!source) throw new Error("ImportSource not found");

    const { normalized, warnings } = normalizePlacePayload({
      rawPayload: record.rawPayload as Record<string, unknown>,
      sourceSlug: source.slug,
      sourceUrl: record.sourceUrl ?? "",
      externalId: record.externalId,
      sourceUpdatedAt: record.sourceUpdatedAt ?? undefined,
    });

    const { score } = scorePlaceImport(normalized);

    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        normalizedData: normalized as object,
        normalizeStatus: "SUCCESS",
        qualityScore: score,
        errorMessage: warnings.length > 0 ? `warnings: ${warnings.join("; ")}` : null,
      },
    });

    return { recordId: record.id, success: true, entityType: "PLACE", qualityScore: score, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: { normalizeStatus: "FAILED", errorMessage: message },
    });
    return { recordId: record.id, success: false, error: message };
  }
}

// ── EVENT ─────────────────────────────────────────────────────────────────────

async function normalizeEventRecord(
  record: {
    id: string;
    sourceId: string;
    rawPayload: unknown;
    sourceUrl: string | null;
    externalId: string | null;
    sourceUpdatedAt: Date | null;
    publishedActivityId: string | null;
  },
): Promise<NormalizeRecordResult> {
  try {
    const source = await prisma.importSource.findUnique({ where: { id: record.sourceId } });
    if (!source) throw new Error("ImportSource not found");

    // ABWS records carry sessions[] that normalizeEventPayload has no
    // concept of (confirmed: it returns venueName/startAt/priceText all
    // undefined for them) — dispatch by parserKey to a normalizer that
    // reads that shape directly. Every other source, including family.by,
    // is untouched: normalizeEventPayload is still called exactly as
    // before for anything that isn't this one parserKey.
    const normalizeFn =
      source.parserKey === ABWS_PARSER_KEY ? normalizeAbwsEventPayload : normalizeEventPayload;

    const { normalized, warnings } = normalizeFn({
      rawPayload: record.rawPayload as Record<string, unknown>,
      sourceSlug: source.slug,
      sourceUrl: record.sourceUrl ?? "",
      externalId: record.externalId,
      sourceUpdatedAt: record.sourceUpdatedAt ?? undefined,
    });

    const { score } = scoreEventImport(normalized);

    // Gate marks are ABWS-specific and computed straight from the raw
    // payload shape (not from `normalized`) — same dispatch-by-parserKey
    // as the normalizer above. Non-ABWS records keep qualityFlags: null,
    // untouched, exactly as before this field existed.
    const qualityFlags =
      source.parserKey === ABWS_PARSER_KEY
        ? computeAbwsQualityFlags(record.rawPayload as unknown as AbwsPerformanceRawPayload)
        : undefined;

    await prisma.importedRecord.update({
      where: { id: record.id },
      data: {
        normalizedData: normalized as object,
        normalizeStatus: "SUCCESS",
        qualityScore: score,
        errorMessage: warnings.length > 0 ? `warnings: ${warnings.join("; ")}` : null,
        ...(qualityFlags !== undefined ? { qualityFlags: qualityFlags as object } : {}),
      },
    });

    // A changed ABWS snapshot for an already-published event must keep its
    // schedule current without requiring the reviewer to "publish" the same
    // ImportedRecord again (that entrypoint intentionally refuses already-
    // linked records). This auto-sync is deliberately narrow: sessions and
    // nextOccurrenceAt only. Titles/descriptions/prices/etc. remain under the
    // existing review/non-destructive rules. The session helper also respects
    // PREFER_MANUAL/LOCKED schedule ownership.
    if (
      source.parserKey === ABWS_PARSER_KEY &&
      record.publishedActivityId &&
      Array.isArray(normalized.occurrences)
    ) {
      const scheduleSync = await upsertActivitySessionsFromOccurrences(
        record.publishedActivityId,
        normalized.occurrences,
      );
      if (scheduleSync.blockedByManualOverride) {
        warnings.push("published ABWS schedule sync skipped: schedule is manually owned");
      }
      if (scheduleSync.skipped > 0) {
        warnings.push(`${scheduleSync.skipped} occurrence(s) skipped: missing externalId or startAt`);
      }
      if (scheduleSync.withdrawnMissing > 0) {
        warnings.push(`${scheduleSync.withdrawnMissing} disappeared source session(s) marked withdrawn`);
      }

      if (warnings.length > 0) {
        await prisma.importedRecord.update({
          where: { id: record.id },
          data: { errorMessage: `warnings: ${warnings.join("; ")}` },
        });
      }
    }

    return { recordId: record.id, success: true, entityType: "EVENT", qualityScore: score, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.importedRecord.update({
      where: { id: record.id },
      data: { normalizeStatus: "FAILED", errorMessage: message },
    });
    return { recordId: record.id, success: false, error: message };
  }
}

// ── Batch ─────────────────────────────────────────────────────────────────────

/**
 * Нормализовать все PLACE и EVENT записи одного run.
 */
export async function normalizeRunRecords(runId: string): Promise<NormalizeRecordResult[]> {
  const records = await prisma.importedRecord.findMany({
    where: {
      runId,
      normalizeStatus: "PENDING",
      entityTypeHint: { in: ["PLACE", "EVENT"] },
    },
    select: { id: true },
  });

  const results: NormalizeRecordResult[] = [];
  for (const { id } of records) {
    results.push(await normalizeRecord(id));
  }
  return results;
}
