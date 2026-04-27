/**
 * ImportRunService — Phase 2A
 */

import type { ImportRun, ImportRunStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import * as repo from "../repositories/import-run.repository";

export async function getRunsBySource(sourceId: string, limit?: number): Promise<ImportRun[]> {
  return repo.findImportRunsBySource(sourceId, limit);
}

export async function getRunById(id: string): Promise<ImportRun | null> {
  return repo.findImportRunById(id);
}

export async function getRunsByStatus(status: ImportRunStatus): Promise<ImportRun[]> {
  return repo.findImportRunsByStatus(status);
}

export async function getRecentRuns(limit = 50): Promise<ImportRun[]> {
  return repo.findImportRunsByStatus("COMPLETED").then((runs) => runs.slice(0, limit));
}

/**
 * Проверяет, можно ли удалить run (ни одна запись не применена).
 */
export async function canDeleteImportRun(runId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  counts?: { applied: number };
}> {
  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });
  if (!run) return { canDelete: false, reason: "Run not found" };

  const applied = await prisma.importedRecord.count({
    where: {
      runId,
      applyResult: { not: null as unknown as Prisma.JsonNullValueFilter },
    },
  });

  if (applied > 0) {
    return {
      canDelete: false,
      reason: "has_applied_records",
      counts: { applied },
    };
  }

  return { canDelete: true };
}

/**
 * Hard delete — разрешён только если ни одна запись не была применена (applyResult == null).
 * Удаляет ImportRun + связанные ImportedRecord (каскадно через onDelete: Cascade в ImportReviewTask).
 */
export async function deleteRun(runId: string): Promise<void> {
  const run = await prisma.importRun.findUnique({
    where: { id: runId },
    select: { id: true },
  });
  if (!run) throw new Error("Run not found");

  const appliedCount = await prisma.importedRecord.count({
    where: { 
      runId, 
      applyResult: { 
        not: null as unknown as Prisma.JsonNullValueFilter 
      } 
    },
  });
  if (appliedCount > 0) {
    throw new Error(
      `Нельзя удалить: ${appliedCount} записей уже применены. Используйте архивирование.`,
    );
  }

  // ImportReviewTask удаляется каскадно через ImportedRecord (onDelete: Cascade)
  // ImportedRecord не имеет onDelete: Cascade на runId — удаляем явно
  await prisma.$transaction([
    prisma.importedRecord.deleteMany({ where: { runId } }),
    prisma.importRun.delete({ where: { id: runId } }),
  ]);
}

/**
 * Soft delete — скрывает run из основного списка, сохраняет для аудита.
 */
export async function archiveRun(runId: string): Promise<ImportRun> {
  const run = await prisma.importRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  return prisma.importRun.update({ where: { id: runId }, data: { isArchived: true } });
}

/**
 * Восстановить архивированный run.
 */
export async function unarchiveRun(runId: string): Promise<ImportRun> {
  return prisma.importRun.update({ where: { id: runId }, data: { isArchived: false } });
}
