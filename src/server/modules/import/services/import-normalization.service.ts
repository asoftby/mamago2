/**
 * ImportNormalizationService
 * raw ImportedRecord → normalizedData + qualityScore
 *
 * Поддерживает PLACE и EVENT.
 * Не делает matching. Для уже опубликованных ABWS EVENT выполняет узкую
 * синхронизацию расписания (ActivitySession + nextOccurrenceAt), не полный publish.
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
import { TELEGRAM_CHANNEL_PARSER_KEY } from "../parsers/telegram-channel-constants";
import { getTelegramPostNormalizer } from "./telegram-post-normalization.service";

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
export async function normalizeRecord(
  recordId: string,
  options: { runId?: string } = {},
): Promise<NormalizeRecordResult> {
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
  if (entityType === "EVENT") {
    // Посты Telegram-каналов разбирает модель: отдельная асинхронная ветка с
    // бюджетом запуска, дочерними записями подборок и автоотсевом.
    const source = await prisma.importSource.findUnique({
      where: { id: record.sourceId },
      select: { parserKey: true },
    });
    if (source?.parserKey === TELEGRAM_CHANNEL_PARSER_KEY) return normalizeTelegramRecord(recordId, options.runId);
    return normalizeEventRecord(record);
  }

  await prisma.importedRecord.update({
    where: { id: recordId },
    data: { normalizeStatus: "SKIPPED", errorMessage: `Unsupported entityType: ${entityType}` },
  });
  return { recordId, success: false, error: `Unsupported entityType: ${entityType}` };
}

// ── Telegram channel post ─────────────────────────────────────────────────────

async function normalizeTelegramRecord(recordId: string, runId?: string): Promise<NormalizeRecordResult> {
  try {
    const outcome = await getTelegramPostNormalizer().normalize(recordId, { runId });
    switch (outcome.status) {
      case "normalized":
        return { recordId, success: true, entityType: "EVENT" };
      case "skipped":
        return { recordId, success: true, entityType: "EVENT", warnings: [`skipped: ${outcome.reason}`] };
      case "postponed":
        // Остаётся PENDING и добирается следующим запуском.
        return { recordId, success: false, entityType: "EVENT", error: `postponed: ${outcome.reason}` };
      case "failed":
        return { recordId, success: false, entityType: "EVENT", error: outcome.code };
    }
  } catch (err) {
    const code = "TELEGRAM_NORMALIZER_ERROR";
    console.error(`[telegram-post-normalizer] recordId=${recordId} code=${code}`, err instanceof Error ? err.name : "error");
    await prisma.importedRecord.update({
      where: { id: recordId },
      data: { normalizeStatus: "FAILED", errorMessage: code },
    });
    return { recordId, success: false, error: code };
  }
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
    // existing review/non-destructive rules.
    if (
      source.parserKey === ABWS_PARSER_KEY &&
      record.publishedActivityId &&
      Array.isArray(normalized.occurrences)
    ) {
      // Fail closed on mixed/legacy ownership. A clean imported ABWS Activity
      // has source-owned sessions (or zero sessions during its first publish).
      // source=NULL rows can be real manual edits or the historical #298
      // destructive-resync artifact; blindly adding source rows on top would
      // create a mixed duplicate schedule. The guarded reconcile operation can
      // inspect and repair that state explicitly.
      const sourceNullSessions = await prisma.activitySession.count({
        where: { activityId: record.publishedActivityId, source: null },
      });

      if (sourceNullSessions > 0) {
        warnings.push(
          `published ABWS schedule auto-sync skipped: ${sourceNullSessions} source-null session(s) require guarded reconcile`,
        );
      } else {
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
  // Для Telegram-каналов к записям запуска добавляются записи прошлых запусков,
  // отложенные из-за бюджета вызовов модели: сначала свежие, потом старые.
  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { sourceId: true, source: { select: { parserKey: true } } },
  });
  const withBacklog = run?.source.parserKey === TELEGRAM_CHANNEL_PARSER_KEY;

  const records = await prisma.importedRecord.findMany({
    where: {
      normalizeStatus: "PENDING",
      entityTypeHint: { in: ["PLACE", "EVENT"] },
      ...(withBacklog ? { OR: [{ runId }, { sourceId: run!.sourceId }] } : { runId }),
    },
    select: { id: true, runId: true },
    orderBy: { createdAt: "desc" },
  });
  // Текущий запуск первым, остаток от старых запусков следом.
  records.sort((a, b) => Number(b.runId === runId) - Number(a.runId === runId));

  const results: NormalizeRecordResult[] = [];
  for (const { id } of records) {
    results.push(await normalizeRecord(id, { runId }));
  }
  return results;
}
