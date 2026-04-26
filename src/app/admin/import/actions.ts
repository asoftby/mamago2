"use server";

import { getCurrentUser } from "@/lib/auth/server";
import { runImportForSource } from "@/server/modules/import/services/import-pipeline.service";
import {
  createImportSource,
  updateImportSource,
  archiveImportSource,
  activateImportSource,
  deactivateImportSource,
} from "@/server/modules/import/services/import-source.service";
import {
  deleteRun,
  archiveRun,
} from "@/server/modules/import/services/import-run.service";
import { matchRecord } from "@/server/modules/import/services/import-matching.service";
import {
  ensureMissingReviewTasksForRun,
  repairOrphanImportReviewTasks,
} from "@/server/modules/import/services/import-review-task.service";
import { applyDecision } from "@/server/modules/import/services/import-review.service";
import { publishApprovedRecord, publishApprovedEventRecord } from "@/server/modules/import/services/import-publish.service";
import { getParser } from "@/server/modules/import/parsers/registry";
import { normalizePlacePayload } from "@/server/modules/import/normalizers/place.normalizer";
import { normalizeEventPayload } from "@/server/modules/import/normalizers/event.normalizer";
import { scorePlaceImport, scoreEventImport } from "@/server/modules/import/services/import-quality.service";
import type { ReviewDecisionPayload } from "@/server/modules/import/types";
import type { ImportSourceType, ImportEntityType, ImportSourceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { type ImportSource } from "@prisma/client";
import { reconcileImportedRecordLinkById, reconcileImportedRecordLinks } from "@/server/modules/import/services/import-link-reconciliation.service";

function requireAdmin(role: string) {
  if (role !== "ADMIN" && role !== "MODERATOR") {
    throw new Error("Access denied");
  }
}

/**
 * Запустить import run для одного источника вручную.
 */
export async function triggerImportRun(sourceId: string): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
  stats?: {
    totalFetched: number;
    totalParsed: number;
    totalCreated: number;
    totalSkipped: number;
    totalErrors: number;
    normalizeSuccess: number;
    normalizeFailed: number;
    matchMatched: number;
    matchNoMatch: number;
    matchAmbiguous: number;
    reviewTasksCreated: number;
  };
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const result = await runImportForSource(sourceId, user.id);

    revalidatePath("/admin/import/sources");
    revalidatePath("/admin/import/runs");

    return {
      success: result.status === "COMPLETED",
      runId: result.runId,
      error: result.error,
      stats: {
        totalFetched: result.totalFetched,
        totalParsed: result.totalParsed,
        totalCreated: result.totalCreated,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
        normalizeSuccess: result.normalizeResults.success,
        normalizeFailed: result.normalizeResults.failed,
        matchMatched: result.matchResults.matched,
        matchNoMatch: result.matchResults.noMatch,
        matchAmbiguous: result.matchResults.ambiguous,
        reviewTasksCreated: result.matchResults.reviewTasksCreated,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Создать новый ImportSource.
 */
export async function createImportSourceAction(data: {
  name: string;
  slug: string;
  type: ImportSourceType;
  parserKey?: string;
  baseUrl?: string;
  defaultEntity?: ImportEntityType;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const source = await createImportSource(data);
    revalidatePath("/admin/import/sources");
    return { success: true, id: source.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Применить approved ImportedRecord к Place.
 * Явный admin trigger — не автоматический.
 * Опирается на reviewDecision, не на suggestedAction.
 */
export async function applyImportRecord(importedRecordId: string): Promise<{
  success: boolean;
  placeId?: string;
  appliedFields?: string[];
  skippedFields?: string[];
  emptyFields?: string[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const result = await publishApprovedRecord(importedRecordId, user.id);

    if (!result.success) {
      return { success: false, error: (result as { reason: string }).reason };
    }

    revalidatePath(`/admin/import/review`);

    const applyResult = result as {
      placeId: string;
      appliedFields: string[];
      skippedFields: string[];
      emptyFields: string[];
    };

    return {
      success: true,
      placeId: applyResult.placeId,
      appliedFields: applyResult.appliedFields,
      skippedFields: applyResult.skippedFields,
      emptyFields: applyResult.emptyFields,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
/**
 * Применить approved EVENT ImportedRecord в Activity.
 * Явный admin trigger — не автоматический.
 */
export async function applyImportEventRecord(importedRecordId: string): Promise<{
  success: boolean;
  activityId?: string;
  activitySlug?: string;
  appliedFields?: string[];
  skippedFields?: string[];
  emptyFields?: string[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const result = await publishApprovedEventRecord(importedRecordId, user.id);

    if (!result.success) {
      return { success: false, error: (result as { reason: string }).reason };
    }

    // Минимальный revalidate — только страница ревью, не весь каталог
    revalidatePath(`/admin/import/review/${importedRecordId}`);

    const applyResult = result as {
      placeId: string;
      activitySlug?: string;
      appliedFields: string[];
      skippedFields: string[];
      emptyFields: string[];
    };

    return {
      success: true,
      activityId: applyResult.placeId,
      activitySlug: applyResult.activitySlug,
      appliedFields: applyResult.appliedFields,
      skippedFields: applyResult.skippedFields,
      emptyFields: applyResult.emptyFields,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
export async function submitReviewDecision(
  taskId: string,
  payload: Omit<ReviewDecisionPayload, "reviewerUserId" | "reviewedAt">,
): Promise<{
  success: boolean;
  error?: string;
  data?: {
    task: {
      id: string;
      status: string;
      suggestedAction: string | null;
      reviewedAt: string | null;
      priority: number;
      notes: string | null;
      reviewerUserId: string | null;
      decision: string | null;
    };
    importedRecord: {
      id: string;
      reviewStatus: string;
      reviewDecision: ReviewDecisionPayload | null;
      publishedPlaceId: string | null;
      publishedActivityId: string | null;
    };
  };
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await applyDecision(taskId, {
      ...payload,
      reviewerUserId: user.id,
      reviewedAt: new Date().toISOString(),
    });

    const updatedTask = await prisma.importReviewTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        suggestedAction: true,
        reviewedAt: true,
        priority: true,
        notes: true,
        reviewerUserId: true,
        decision: true,
        importedRecord: {
          select: {
            id: true,
            reviewStatus: true,
            reviewDecision: true,
            publishedPlaceId: true,
            publishedActivityId: true,
          },
        },
      },
    });

    if (!updatedTask) {
      return { success: false, error: "ImportReviewTask not found after update" };
    }

    revalidatePath("/admin/import/review");
    return {
      success: true,
      data: {
        task: {
          id: updatedTask.id,
          status: updatedTask.status,
          suggestedAction: updatedTask.suggestedAction,
          reviewedAt: updatedTask.reviewedAt?.toISOString() ?? null,
          priority: updatedTask.priority,
          notes: updatedTask.notes,
          reviewerUserId: updatedTask.reviewerUserId,
          decision: updatedTask.decision,
        },
        importedRecord: {
          id: updatedTask.importedRecord.id,
          reviewStatus: updatedTask.importedRecord.reviewStatus,
          reviewDecision: (updatedTask.importedRecord.reviewDecision as ReviewDecisionPayload | null) ?? null,
          publishedPlaceId: updatedTask.importedRecord.publishedPlaceId,
          publishedActivityId: updatedTask.importedRecord.publishedActivityId,
        },
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Забрать задачу в работу — переводит статус PENDING → IN_PROGRESS.
 */
export async function claimReviewTaskAction(
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await prisma.importReviewTask.update({
      where: { id: taskId },
      data: { status: "IN_PROGRESS", reviewerUserId: user.id },
    });

    revalidatePath("/admin/import/review");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Удалить задачу ревью + связанную ImportedRecord.
 * Запрещено если запись уже применена (publishedPlaceId / publishedActivityId).
 */
export async function deleteReviewTaskAction(
  taskId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const task = await prisma.importReviewTask.findUnique({
      where: { id: taskId },
      include: {
        importedRecord: {
          select: { id: true, publishedPlaceId: true, publishedActivityId: true, reviewDecision: true, applyResult: true },
        },
      },
    });

    if (!task) return { success: false, error: "Task not found" };

    const rec = await reconcileImportedRecordLinkById(task.importedRecord.id);
    if (!rec) return { success: false, error: "Imported record not found" };
    if (rec.publishedPlaceId || rec.publishedActivityId) {
      return {
        success: false,
        error: "Нельзя удалить: запись уже применена к каталогу.",
      };
    }

    // ImportReviewTask удаляется каскадно через ImportedRecord (onDelete: Cascade)
    await prisma.importedRecord.delete({ where: { id: rec.id } });

    revalidatePath("/admin/import/review");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteImportedRecordAction(
  importedRecordId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const record = await reconcileImportedRecordLinkById(importedRecordId);

    if (!record) return { success: false, error: "Imported record not found" };

    if (record.publishedPlaceId || record.publishedActivityId) {
      return {
        success: false,
        error: "Нельзя удалить: запись уже применена к каталогу.",
      };
    }

    await prisma.importedRecord.delete({ where: { id: importedRecordId } });

    revalidatePath("/admin/import/review");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function bulkDeleteImportedRecords(
  importedRecordIds: string[],
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const records = await prisma.importedRecord.findMany({
      where: { id: { in: importedRecordIds } },
      select: { id: true, publishedPlaceId: true, publishedActivityId: true, reviewDecision: true, applyResult: true },
    });

    const reconciledRecords = await reconcileImportedRecordLinks(records, prisma);

    const appliedRecords = reconciledRecords.filter((record) =>
      record.publishedPlaceId || record.publishedActivityId,
    );

    if (appliedRecords.length > 0) {
      return {
        success: false,
        error: `Нельзя удалить ${appliedRecords.length} записей: они уже применены к каталогу.`,
      };
    }

    const deleteResult = await prisma.importedRecord.deleteMany({
      where: { id: { in: importedRecordIds } },
    });

    revalidatePath("/admin/import/review");
    return { success: true, count: deleteResult.count };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Обновить ImportSource (name, baseUrl, parserKey, status, notes и т.д.)
 */
export async function updateImportSourceAction(
  sourceId: string,
  data: {
    name?: string;
    baseUrl?: string;
    parserKey?: string;
    status?: ImportSourceStatus;
    defaultEntity?: ImportEntityType;
    isTrusted?: boolean;
    isAutoUpdate?: boolean;
    notes?: string;
    crawlMaxPages?: number | null;
    crawlMaxDetailLinks?: number | null;
    crawlMaxRecords?: number | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await updateImportSource(sourceId, data);
    revalidatePath("/admin/import/sources");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Архивировать ImportSource (soft delete).
 */
export async function archiveImportSourceAction(
  sourceId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await archiveImportSource(sourceId);
    revalidatePath("/admin/import/sources");
    revalidatePath("/admin/import");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Hard delete ImportRun — разрешён только если totalApplied == 0.
 */
export async function deleteImportRunAction(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await deleteRun(runId);
    revalidatePath("/admin/import/runs");
    revalidatePath("/admin/import");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Архивировать ImportRun (soft delete — скрыть из основного списка).
 */
export async function archiveImportRunAction(
  runId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    await archiveRun(runId);
    revalidatePath("/admin/import/runs");
    revalidatePath("/admin/import");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Восстановить инвариант ImportReviewTask для run и заново прогнать matching для SKIPPED PLACE/EVENT.
 */
export async function rematchOrphanedRecordsAction(
  runId: string,
): Promise<{ success: boolean; created: number; failed: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, created: 0, failed: 0, error: "Unauthorized" };
    requireAdmin(user.role);

    const { created: tasksCreated } = await ensureMissingReviewTasksForRun(runId);

    const skipped = await prisma.importedRecord.findMany({
      where: {
        runId,
        normalizeStatus: "SUCCESS",
        entityTypeHint: { in: ["PLACE", "EVENT"] },
        matchStatus: "SKIPPED",
      },
      select: { id: true },
    });

    let failed = 0;
    for (const { id } of skipped) {
      await prisma.importedRecord.update({
        where: { id },
        data: { matchStatus: "PENDING", errorMessage: null },
      });
      const result = await matchRecord(id);
      if (!result.success && !result.reviewTask?.taskId) failed++;
    }

    revalidatePath(`/admin/import/runs/${runId}`);
    revalidatePath("/admin/import/review");
    return { success: true, created: tasksCreated, failed };
  } catch (err) {
    return { success: false, created: 0, failed: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Создать отсутствующие ImportReviewTask для всех сирот в базе (или в одном run). Batch limit по умолчанию 50k.
 */
export async function repairOrphanImportReviewTasksAction(options?: {
  runId?: string;
  limit?: number;
}): Promise<{ success: boolean; scanned: number; created: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, scanned: 0, created: 0, error: "Unauthorized" };
    requireAdmin(user.role);

    const { scanned, created } = await repairOrphanImportReviewTasks({
      runId: options?.runId,
      limit: options?.limit,
    });
    revalidatePath("/admin/import");
    revalidatePath("/admin/import/review");
    if (options?.runId) revalidatePath(`/admin/import/runs/${options.runId}`);
    return { success: true, scanned, created };
  } catch (err) {
    return {
      success: false,
      scanned: 0,
      created: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Тестировать парсер источника — safe preview, НЕ создаёт ImportRun / ImportedRecord.
 * Возвращает preview первых N записей с нормализацией и quality score.
 */
export async function testImportSource(sourceId: string): Promise<{
  success: boolean;
  parserKey?: string;
  sourceUrl?: string;
  totalParsed?: number;
  previews?: Array<{
    externalId: string | null;
    sourceUrl: string;
    rawPreview: Record<string, unknown>;
    normalized: unknown;
    qualityScore: number;
    warnings: string[];
    error?: string;
  }>;
  debug?: {
    startUrl: string;
    pagesVisited: number;
    linksDiscovered: number;
    detailCandidates: number;
    recordsExtracted: number;
    pagesSkipped: number;
    limitReached: string | null;
    warnings: string[];
    sampleVisited: string[];
    sampleSkipped: Array<{ url: string; reason: string }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    requireAdmin(user.role);

    const source = await prisma.importSource.findUnique({ where: { id: sourceId } });
    if (!source) return { success: false, error: "Source not found" };
    if (!source.parserKey) return { success: false, error: "Source has no parserKey configured" };

    const parser = getParser(source.parserKey);
    if (!parser) return { success: false, error: `No parser registered for key: "${source.parserKey}"` };

    // Run parser — no DB writes
    const parserResult = await parser.parse(source);

    if (parserResult.error && parserResult.records.length === 0) {
      return {
        success: false,
        parserKey: source.parserKey,
        error: parserResult.error,
        // @ts-expect-error debug is optional extension
        debug: parserResult.debug,
      };
    }

    const entityType = source.defaultEntity ?? "PLACE";
    const PREVIEW_LIMIT = 5;
    const previews = [];

    for (const raw of parserResult.records.slice(0, PREVIEW_LIMIT)) {
      try {
        let normalized: unknown;
        let qualityScore: number;
        let warnings: string[];

        if (entityType === "PLACE") {
          const result = normalizePlacePayload({
            rawPayload: raw.rawPayload,
            sourceSlug: source.slug,
            sourceUrl: raw.sourceUrl,
            externalId: raw.externalId,
            sourceUpdatedAt: raw.sourceUpdatedAt,
          });
          normalized = result.normalized;
          warnings = result.warnings;
          qualityScore = scorePlaceImport(result.normalized).score;
        } else {
          const result = normalizeEventPayload({
            rawPayload: raw.rawPayload,
            sourceSlug: source.slug,
            sourceUrl: raw.sourceUrl,
            externalId: raw.externalId,
            sourceUpdatedAt: raw.sourceUpdatedAt,
          });
          normalized = result.normalized;
          warnings = result.warnings;
          qualityScore = scoreEventImport(result.normalized).score;
        }

        previews.push({
          externalId: raw.externalId ?? null,
          sourceUrl: raw.sourceUrl,
          rawPreview: raw.rawPayload,
          normalized,
          qualityScore,
          warnings,
        });
      } catch (err) {
        previews.push({
          externalId: raw.externalId ?? null,
          sourceUrl: raw.sourceUrl,
          rawPreview: raw.rawPayload,
          normalized: null,
          qualityScore: 0,
          warnings: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      success: true,
      parserKey: source.parserKey,
      sourceUrl: source.baseUrl ?? undefined,
      totalParsed: parserResult.totalFound,
      previews,
      // @ts-expect-error debug is optional extension from directory parser
      debug: parserResult.debug,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Updates the active status of an import source
 * @param sourceId The ID of the import source to update
 * @param isActive The new active status to set
 * @returns A promise with success status and updated source or error
 */
async function updateImportSourceActiveStatus(
  sourceId: string, 
  isActive: boolean
): Promise<{
  success: boolean;
  source?: ImportSource;
  error?: string;
}> {
  // Verify the source exists
  const source = await prisma.importSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      name: true,
      status: true,
      isActive: true,
    }
  });
  
  if (!source) {
    throw new Error(`Import source with ID ${sourceId} not found`);
  }
  
  const isCurrentlyActive = source.isActive;
  if (isCurrentlyActive === isActive) {
    throw new Error(`Import source ${sourceId} is already ${isActive ? 'active' : 'inactive'}`);
  }

  const updatedSource = isActive
    ? await activateImportSource(sourceId)
    : await deactivateImportSource(sourceId);

  revalidatePath("/admin/import/sources");
  revalidatePath("/admin/import");
  return { success: true, source: updatedSource };
}

/**
 * Deactivates an import source after validation
 * @param sourceId The ID of the import source to deactivate
 * @returns A promise with success status and updated source or error
 */
export async function deactivateImportSourceAction(sourceId: string): Promise<{
  success: boolean;
  source?: ImportSource;
  error?: string;
}> {
  try {
    return await updateImportSourceActiveStatus(sourceId, false);
  } catch (error) {
    console.error('Error deactivating import source:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Activates an import source after validation
 * @param sourceId The ID of the import source to activate
 * @returns A promise with success status and updated source or error
 */
export async function activateImportSourceAction(sourceId: string): Promise<{
  success: boolean;
  source?: ImportSource;
  error?: string;
}> {
  try {
    return await updateImportSourceActiveStatus(sourceId, true);
  } catch (error) {
    console.error('Error activating import source:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}
