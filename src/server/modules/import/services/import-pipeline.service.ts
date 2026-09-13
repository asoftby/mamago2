/**
 * ImportPipelineService — оркестратор одного import run.
 *
 * Flow:
 *   1. Создать ImportRun (status: RUNNING)
 *   2. Получить парсер по source.parserKey
 *   3. Запустить парсер → ParsedRawRecord[]
 *   4. Сохранить ImportedRecord + сразу ImportReviewTask (инвариант 1:1)
 *   5. Нормализовать каждую запись (normalizeStatus: SUCCESS/FAILED)
 *   6. Matching — обновляет только кандидатов, matchStatus и рекомендации в существующей задаче
 *   7. Обновить ImportRun (status: COMPLETED/FAILED, счётчики)
 *   8. Обновить ImportSource.lastRunAt / lastSuccessAt / lastErrorAt
 */

import prisma from "@/lib/prisma";
import { GlobalLock } from "@/server/ops/lock/GlobalLock";
import { computeContentHash } from "../utils/content-hash";
import { getParser } from "../parsers/registry";
import { normalizeRunRecords } from "./import-normalization.service";
import { matchRunRecords } from "./import-matching.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";
import { normalizePlacePayload } from "../normalizers/place.normalizer";
import { normalizeEventPayload } from "../normalizers/event.normalizer";
import { scorePlaceImport, scoreEventImport } from "./import-quality.service";

/**
 * One session-level advisory lock per ImportSource, so two overlapping
 * `runImportForSource` calls for the same source can't both proceed (Phase 0
 * gap — previously nothing guarded this). Reuses the existing GlobalLock
 * primitive (§21 Step 2, Phase D) already used by the worker/detectors;
 * this is its first use from the Next.js app runtime rather than the
 * worker process, but the primitive itself is unchanged.
 */
const IMPORT_SOURCE_LOCK_PREFIX = "import-source:";
export function importSourceLockName(sourceId: string): string {
  return `${IMPORT_SOURCE_LOCK_PREFIX}${sourceId}`;
}

/**
 * Distinct from any future "user cancelled a run" feature, which would also
 * naturally use ImportRunStatus.CANCELLED (nothing sets that status today —
 * checked before reusing it here) — keep this prefix so the two are never
 * ambiguous from errorMessage alone.
 */
const SKIPPED_LOCKED_MESSAGE_PREFIX = "Skipped (concurrent run):";

export interface RunImportResult {
  runId: string;
  sourceId: string;
  /** SKIPPED_LOCKED: another run for this source was already in progress; this call did not start one. */
  status: "COMPLETED" | "FAILED" | "SKIPPED_LOCKED";
  totalFetched: number;
  totalParsed: number;
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  normalizeResults: { success: number; failed: number };
  matchResults: { matched: number; noMatch: number; ambiguous: number; failed: number; reviewTasksCreated: number };
  error?: string;
}

/**
 * Запустить import pipeline для одного источника.
 * Dev-safe: без фоновых workers, без cron.
 */
export async function runImportForSource(
  sourceId: string,
  triggeredByUserId?: string,
): Promise<RunImportResult> {
  const source = await prisma.importSource.findUnique({ where: { id: sourceId, isActive: true } });
  if (!source) throw new Error(`ImportSource not found or inactive: ${sourceId}`);

  if (!source.parserKey) {
    throw new Error(`ImportSource "${source.slug}" has no parserKey configured`);
  }

  const parser = getParser(source.parserKey);
  if (!parser) {
    throw new Error(`No parser registered for key: "${source.parserKey}"`);
  }

  const lock = new GlobalLock(process.env.DATABASE_URL!);
  await lock.connect();
  const lockName = importSourceLockName(sourceId);
  const acquired = await lock.tryAcquire(lockName);

  if (!acquired) {
    await lock.close();

    const message = `${SKIPPED_LOCKED_MESSAGE_PREFIX} another import run for source "${source.slug}" was already in progress.`;
    const now = new Date();

    // Terminal row from the start (never RUNNING) — no orphan to clean up —
    // but still gives this a visible trace in /admin/import/runs instead of
    // silently doing nothing.
    const skippedRun = await prisma.importRun.create({
      data: {
        source: { connect: { id: sourceId } },
        status: "CANCELLED",
        startedAt: now,
        finishedAt: now,
        triggerType: triggeredByUserId ? "MANUAL" : "MANUAL",
        triggerUserId: triggeredByUserId ?? null,
        errorMessage: message,
      },
    });

    // Deliberately NOT writing lastErrorAt/lastErrorMessage on ImportSource
    // here: verified by test that the concurrently-succeeding run's own
    // completion handler unconditionally clears those same two fields to
    // null on success (see the "8. Обновить source stats" block below),
    // which races this write and silently erases it whenever the winning
    // run finishes after this one returns — i.e. in exactly the scenario
    // this field would exist to document. The CANCELLED ImportRun row
    // above is the reliable trace; ImportSource is not, without also
    // changing that unconditional clear-on-success behavior (a separate,
    // wider decision — it's shared by every source, not ABWS-specific).
    return {
      runId: skippedRun.id,
      sourceId,
      status: "SKIPPED_LOCKED",
      totalFetched: 0,
      totalParsed: 0,
      totalCreated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      normalizeResults: { success: 0, failed: 0 },
      matchResults: { matched: 0, noMatch: 0, ambiguous: 0, failed: 0, reviewTasksCreated: 0 },
      error: message,
    };
  }

  try {
  // 1. Создать run
  const run = await prisma.importRun.create({
    data: {
      source: { connect: { id: sourceId } },
      status: "RUNNING",
      startedAt: new Date(),
      triggerType: triggeredByUserId ? "MANUAL" : "MANUAL",
      triggerUserId: triggeredByUserId ?? null,
    },
  });

  // Обновить source.lastRunAt
  await prisma.importSource.update({
    where: { id: sourceId },
    data: { lastRunAt: new Date() },
  });

  let totalFetched = 0;
  let totalParsed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let ingestReviewTasksCreated = 0;
  let runError: string | undefined;

  try {
    // 2-3. Парсинг
    const parserResult = await parser.parse(source);
    totalFetched = parserResult.totalFound;

    if (parserResult.error) {
      runError = parserResult.error;
    }

    // 4. Сохранить сырые записи
    for (const raw of parserResult.records) {
      try {
        const contentHash = computeContentHash(raw.rawPayload);

        if (raw.externalId) {
          // Non-authoritative fast path: only decides whether to skip an
          // unchanged record without writing. The actual write below is a
          // single atomic upsert on the (sourceId, externalId) unique
          // constraint — safe even if this read is stale (e.g. a
          // concurrent run inserted/updated the row in between), because
          // Postgres resolves the upsert via ON CONFLICT, not by trusting
          // this read. A stale read here costs at most one redundant
          // update; it can never produce a duplicate row.
          const existing = await prisma.importedRecord.findUnique({
            where: { sourceId_externalId: { sourceId, externalId: raw.externalId } },
            select: { id: true, contentHash: true },
          });

          if (existing && existing.contentHash === contentHash) {
            // Контент не изменился — пропускаем без записи
            totalSkipped++;
            continue;
          }

          await prisma.importedRecord.upsert({
            where: { sourceId_externalId: { sourceId, externalId: raw.externalId } },
            create: {
              source: { connect: { id: sourceId } },
              run: { connect: { id: run.id } },
              externalId: raw.externalId,
              sourceUrl: raw.sourceUrl,
              canonicalSourceUrl: raw.canonicalSourceUrl ?? raw.sourceUrl,
              entityTypeHint: source.defaultEntity ?? "PLACE",
              rawPayload: raw.rawPayload as object,
              rawText: raw.rawText ?? null,
              contentHash,
              sourceUpdatedAt: raw.sourceUpdatedAt ?? null,
              parseStatus: "SUCCESS",
              fetchedAt: new Date(),
            },
            update: {
              runId: run.id,
              rawPayload: raw.rawPayload as object,
              rawText: raw.rawText ?? null,
              contentHash,
              sourceUpdatedAt: raw.sourceUpdatedAt ?? null,
              parseStatus: "SUCCESS",
              normalizeStatus: "PENDING",
              matchStatus: "PENDING",
              fetchedAt: new Date(),
              errorMessage: null,
            },
            select: { id: true },
          }).then(async (row) => {
            const tr = await ensureImportReviewTaskExists(row.id);
            if (tr.created) ingestReviewTasksCreated++;
          });

          totalParsed++;
          if (!existing) totalCreated++;
          continue;
        }

        // Нет externalId — дедуп невозможен и не нужен (нечего сопоставлять),
        // как и раньше: всегда новая запись + сразу ImportReviewTask (инвариант 1:1)
        const inserted = await prisma.importedRecord.create({
          data: {
            source: { connect: { id: sourceId } },
            run: { connect: { id: run.id } },
            externalId: null,
            sourceUrl: raw.sourceUrl,
            canonicalSourceUrl: raw.canonicalSourceUrl ?? raw.sourceUrl,
            entityTypeHint: source.defaultEntity ?? "PLACE",
            rawPayload: raw.rawPayload as object,
            rawText: raw.rawText ?? null,
            contentHash,
            sourceUpdatedAt: raw.sourceUpdatedAt ?? null,
            parseStatus: "SUCCESS",
            fetchedAt: new Date(),
          },
        });
        {
          const tr = await ensureImportReviewTaskExists(inserted.id);
          if (tr.created) ingestReviewTasksCreated++;
        }

        totalParsed++;
        totalCreated++;
      } catch (err) {
        totalErrors++;
        console.error(`[import-pipeline] Failed to save record from ${raw.sourceUrl}:`, err);
      }
    }

    // 5. Нормализация
    const normalizeResults = await normalizeRunRecords(run.id);
    const normalizeSuccess = normalizeResults.filter((r) => r.success).length;
    const normalizeFailed = normalizeResults.filter((r) => !r.success).length;

    // 6. Matching + гарантия ImportReviewTask на каждой нормализованной PLACE/EVENT записи
    const { results: matchResults, orphanTasksCreated } = await matchRunRecords(run.id);
    const matchStats = {
      matched: matchResults.filter((r) => r.matchResult?.matchStatus === "MATCHED").length,
      noMatch: matchResults.filter((r) => r.matchResult?.matchStatus === "NO_MATCH").length,
      ambiguous: matchResults.filter((r) => r.matchResult?.matchStatus === "AMBIGUOUS").length,
      failed: matchResults.filter((r) => !r.success).length,
      /** Новые задачи при ingest + safeguard внутри match (legacy-сироты) */
      reviewTasksCreated: ingestReviewTasksCreated + orphanTasksCreated,
    };

    // 7. Завершить run
    const finalStatus = runError ? "FAILED" : "COMPLETED";
    await prisma.importRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        totalFetched,
        totalParsed,
        totalCreated,
        totalSkipped,
        totalErrors: totalErrors + normalizeFailed,
        errorMessage: runError ?? null,
      },
    });

    // 8. Обновить source stats
    if (finalStatus === "COMPLETED") {
      await prisma.importSource.update({
        where: { id: sourceId },
        data: { lastSuccessAt: new Date(), lastErrorAt: null, lastErrorMessage: null },
      });
    } else {
      await prisma.importSource.update({
        where: { id: sourceId },
        data: { lastErrorAt: new Date(), lastErrorMessage: runError ?? "Unknown error" },
      });
    }

    return {
      runId: run.id,
      sourceId,
      status: finalStatus,
      totalFetched,
      totalParsed,
      totalCreated,
      totalSkipped,
      totalErrors,
      normalizeResults: { success: normalizeSuccess, failed: normalizeFailed },
      matchResults: matchStats,
      error: runError,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.importRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message },
    });
    await prisma.importSource.update({
      where: { id: sourceId },
      data: { lastErrorAt: new Date(), lastErrorMessage: message },
    });

    return {
      runId: run.id,
      sourceId,
      status: "FAILED",
      totalFetched,
      totalParsed,
      totalCreated,
      totalSkipped,
      totalErrors,
      normalizeResults: { success: 0, failed: 0 },
      matchResults: { matched: 0, noMatch: 0, ambiguous: 0, failed: 0, reviewTasksCreated: 0 },
      error: message,
    };
  }
  } finally {
    await lock.release(lockName);
    await lock.close();
  }
}

// ── Dry-run preview (no DB writes) ──────────────────────────────────────────

export interface PreviewImportItem {
  sourceUrl: string;
  externalId: string | null;
  entityType: string;
  normalizeSuccess: boolean;
  qualityScore?: number;
  warnings?: string[];
  error?: string;
}

export interface PreviewImportResult {
  sourceId: string;
  sourceSlug: string;
  parserKey: string;
  /** Общее количество записей, найденных парсером (может быть больше totalProcessed) */
  totalFetched: number;
  /** Сколько записей реально прогнали через normalizer (ограничено limit) */
  totalProcessed: number;
  totalParsed: number;
  totalErrors: number;
  fetchError?: string;
  /** Первые несколько обработанных записей для превью */
  items: PreviewImportItem[];
}

/**
 * Dry-run превью import pipeline для одного источника.
 *
 * Гарантированно НЕ пишет в БД: не создаёт ImportRun/ImportedRecord/ImportReviewTask,
 * не обновляет ImportSource. Только читает ImportSource и вызывает parser.parse() +
 * чистые normalizer/scorer функции (без побочных эффектов).
 *
 * Matching намеренно не включён — его persistence (matchStatus, ImportReviewTask
 * рекомендации) неотделим от DB-записи в текущей реализации import-matching.service.ts.
 */
export async function previewImportForSource(
  sourceId: string,
  options: { limit?: number } = {},
): Promise<PreviewImportResult> {
  const limit = options.limit ?? 20;

  const source = await prisma.importSource.findUnique({ where: { id: sourceId, isActive: true } });
  if (!source) throw new Error(`ImportSource not found or inactive: ${sourceId}`);

  if (!source.parserKey) {
    throw new Error(`ImportSource "${source.slug}" has no parserKey configured`);
  }

  const parser = getParser(source.parserKey);
  if (!parser) {
    throw new Error(`No parser registered for key: "${source.parserKey}"`);
  }

  const parserResult = await parser.parse(source);
  const toProcess = parserResult.records.slice(0, limit);

  let totalParsed = 0;
  let totalErrors = 0;
  const items: PreviewImportItem[] = [];

  for (const raw of toProcess) {
    const entityType = source.defaultEntity ?? "PLACE";

    try {
      if (entityType === "PLACE") {
        const { normalized, warnings } = normalizePlacePayload({
          rawPayload: raw.rawPayload,
          sourceSlug: source.slug,
          sourceUrl: raw.sourceUrl,
          externalId: raw.externalId ?? null,
          sourceUpdatedAt: raw.sourceUpdatedAt,
        });
        const { score } = scorePlaceImport(normalized);
        totalParsed++;
        items.push({
          sourceUrl: raw.sourceUrl,
          externalId: raw.externalId ?? null,
          entityType,
          normalizeSuccess: true,
          qualityScore: score,
          warnings,
        });
      } else if (entityType === "EVENT") {
        const { normalized, warnings } = normalizeEventPayload({
          rawPayload: raw.rawPayload,
          sourceSlug: source.slug,
          sourceUrl: raw.sourceUrl,
          externalId: raw.externalId ?? null,
          sourceUpdatedAt: raw.sourceUpdatedAt,
        });
        const { score } = scoreEventImport(normalized);
        totalParsed++;
        items.push({
          sourceUrl: raw.sourceUrl,
          externalId: raw.externalId ?? null,
          entityType,
          normalizeSuccess: true,
          qualityScore: score,
          warnings,
        });
      } else {
        throw new Error(`Unsupported entityType: ${entityType}`);
      }
    } catch (err) {
      totalErrors++;
      items.push({
        sourceUrl: raw.sourceUrl,
        externalId: raw.externalId ?? null,
        entityType,
        normalizeSuccess: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    sourceId,
    sourceSlug: source.slug,
    parserKey: source.parserKey,
    totalFetched: parserResult.totalFound,
    totalProcessed: toProcess.length,
    totalParsed,
    totalErrors,
    fetchError: parserResult.error,
    items,
  };
}
