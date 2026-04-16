/**
 * ImportReviewTask — единица работы по одной ImportedRecord.
 *
 * Инвариант: у каждой ImportedRecord существует ровно одна ImportReviewTask (1:1).
 * Задача создаётся при появлении записи (ingest), а match только выставляет recommendation
 * (suggestedAction, priority), matchStatus и кандидатов на самой ImportedRecord.
 */

import { Prisma } from "@prisma/client";
import type { ImportSuggestedAction } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ReviewTaskCreationResult } from "../types";

const PRIORITY_AT_INGEST = 0;

export const FALLBACK_SUGGESTED_AFTER_MATCH_ERROR: ImportSuggestedAction = "CREATE_NEW";
export const FALLBACK_PRIORITY_AFTER_MATCH_ERROR = 100;

/**
 * Создать ImportReviewTask, если её ещё нет (идемпотентно).
 * Вызывается при создании ImportedRecord и в safeguard/repair.
 */
export async function ensureImportReviewTaskExists(
  importedRecordId: string,
): Promise<ReviewTaskCreationResult> {
  const existing = await prisma.importReviewTask.findUnique({
    where: { importedRecordId },
  });
  if (existing) {
    return {
      recordId: importedRecordId,
      taskId: existing.id,
      created: false,
      reason: "already exists",
    };
  }

  try {
    const task = await prisma.importReviewTask.create({
      data: {
        importedRecord: { connect: { id: importedRecordId } },
        status: "PENDING",
        priority: PRIORITY_AT_INGEST,
      },
    });

    await prisma.importedRecord.update({
      where: { id: importedRecordId },
      data: { reviewStatus: "PENDING" },
    });

    return {
      recordId: importedRecordId,
      taskId: task.id,
      created: true,
      reason: "created",
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const after = await prisma.importReviewTask.findUnique({
        where: { importedRecordId },
      });
      return {
        recordId: importedRecordId,
        taskId: after?.id ?? null,
        created: false,
        reason: "race: unique importedRecordId",
      };
    }
    throw err;
  }
}

export async function ensureImportReviewTaskExistsSafe(
  importedRecordId: string,
): Promise<ReviewTaskCreationResult | undefined> {
  try {
    return await ensureImportReviewTaskExists(importedRecordId);
  } catch (e) {
    console.error(`[import-review-task] ensureImportReviewTaskExists failed record=${importedRecordId}`, e);
    return undefined;
  }
}

/**
 * После успешного или fallback matching: обновить рекомендации в уже существующей задаче.
 */
export async function setReviewTaskRecommendation(
  importedRecordId: string,
  suggestedAction: ImportSuggestedAction,
  priority: number,
): Promise<ReviewTaskCreationResult> {
  await ensureImportReviewTaskExists(importedRecordId);
  const task = await prisma.importReviewTask.update({
    where: { importedRecordId },
    data: { suggestedAction, priority },
  });
  return {
    recordId: importedRecordId,
    taskId: task.id,
    created: false,
    reason: `recommendation suggestedAction=${suggestedAction} priority=${priority}`,
  };
}

export async function setReviewTaskRecommendationSafe(
  importedRecordId: string,
  suggestedAction: ImportSuggestedAction,
  priority: number,
  logContext: string,
): Promise<ReviewTaskCreationResult | undefined> {
  try {
    return await setReviewTaskRecommendation(importedRecordId, suggestedAction, priority);
  } catch (e) {
    console.error(`[import-review-task] setReviewTaskRecommendation failed (${logContext})`, e);
    return undefined;
  }
}

/** Все записи run без задачи — без фильтров по match/normalize/entity. */
export async function ensureMissingReviewTasksForRun(runId: string): Promise<{ created: number }> {
  const orphans = await prisma.importedRecord.findMany({
    where: { runId, reviewTask: null },
    select: { id: true },
  });

  let created = 0;
  for (const { id } of orphans) {
    const r = await ensureImportReviewTaskExistsSafe(id);
    if (r?.created) created++;
  }
  return { created };
}

/** Одна запись: любой сирота, без условий по стадиям pipeline. */
export async function repairMissingImportReviewTask(recordId: string): Promise<boolean> {
  const rec = await prisma.importedRecord.findUnique({
    where: { id: recordId },
    select: { reviewTask: { select: { id: true } } },
  });
  if (!rec || rec.reviewTask) return false;
  const r = await ensureImportReviewTaskExistsSafe(recordId);
  return Boolean(r?.taskId);
}

/**
 * Массовая починка: вся БД или один run. По умолчанию ограничение на объём за проход.
 */
export async function repairOrphanImportReviewTasks(options: {
  runId?: string;
  limit?: number;
}): Promise<{ scanned: number; created: number }> {
  const limit = options.limit ?? 50_000;
  const orphans = await prisma.importedRecord.findMany({
    where: {
      reviewTask: null,
      ...(options.runId ? { runId: options.runId } : {}),
    },
    select: { id: true },
    take: limit,
  });

  let created = 0;
  for (const { id } of orphans) {
    const r = await ensureImportReviewTaskExistsSafe(id);
    if (r?.created) created++;
  }
  return { scanned: orphans.length, created };
}
