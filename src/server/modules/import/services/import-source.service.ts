/**
 * ImportSourceService
 */

import type { ImportSource, ImportSourceStatus, ImportSourceType, ImportFetchStrategy, ImportEntityType } from "@prisma/client";
import * as repo from "../repositories/import-source.repository";
import prisma from "@/lib/prisma";

export type CreateImportSourceDto = {
  name: string;
  slug: string;
  type: ImportSourceType;
  fetchStrategy?: ImportFetchStrategy;
  baseUrl?: string;
  parserKey?: string;
  defaultEntity?: ImportEntityType;
  cityId?: string;
  notes?: string;
  isTrusted?: boolean;
  isAutoUpdate?: boolean;
};

export type UpdateImportSourceDto = {
  name?: string;
  baseUrl?: string;
  parserKey?: string;
  defaultEntity?: ImportEntityType;
  status?: ImportSourceStatus;
  notes?: string;
  isTrusted?: boolean;
  isAutoUpdate?: boolean;
  crawlMaxPages?: number | null;
  crawlMaxDetailLinks?: number | null;
  crawlMaxRecords?: number | null;
};

export type ImportSourceDeletionSummary = {
  runsCount: number;
  importedRecordsCount: number;
  reviewTasksCount: number;
  hasDependencies: boolean;
};

/**
 * Список источников — по умолчанию скрывает архивированные и неактивные.
 */
export async function listImportSources(params?: {
  status?: ImportSourceStatus;
  cityId?: string;
  includeArchived?: boolean;
  includeInactive?: boolean;
}): Promise<ImportSource[]> {
  return repo.findAllImportSources({
    ...params,
    includeArchived: params?.includeArchived ?? false,
    isActive: params?.includeInactive ? undefined : true,
  });
}

export async function getImportSourceById(id: string): Promise<ImportSource | null> {
  return repo.findImportSourceById(id);
}

export async function getImportSourceBySlug(slug: string): Promise<ImportSource | null> {
  return repo.findImportSourceBySlug(slug);
}

export async function createImportSource(dto: CreateImportSourceDto): Promise<ImportSource> {
  const existing = await repo.findImportSourceBySlug(dto.slug);
  if (existing) throw new Error(`ImportSource with slug "${dto.slug}" already exists`);

  return repo.createImportSource({
    name: dto.name,
    slug: dto.slug,
    type: dto.type,
    fetchStrategy: dto.fetchStrategy ?? "HTML_SCRAPE",
    baseUrl: dto.baseUrl,
    parserKey: dto.parserKey,
    defaultEntity: dto.defaultEntity ?? "PLACE",
    notes: dto.notes,
    isTrusted: dto.isTrusted ?? false,
    isAutoUpdate: dto.isAutoUpdate ?? false,
    isActive: true, // New sources are active by default
  });
}

export async function updateImportSource(
  id: string,
  dto: UpdateImportSourceDto,
): Promise<ImportSource> {
  return repo.updateImportSource(id, dto);
}

export async function updateImportSourceStatus(
  id: string,
  status: ImportSourceStatus,
): Promise<ImportSource> {
  return repo.updateImportSource(id, { status });
}

/**
 * Soft delete — выставляет archivedAt, не удаляет данные.
 * История ImportRun и ImportedRecord сохраняется.
 */
export async function archiveImportSource(id: string): Promise<ImportSource> {
  return repo.updateImportSource(id, { archivedAt: new Date() });
}

/**
 * Восстановить архивированный источник.
 */
export async function unarchiveImportSource(id: string): Promise<ImportSource> {
  return repo.updateImportSource(id, { archivedAt: null });
}

/**
 * Деактивировать источник — выставляет isActive = false, не удаляет данные.
 * Источник не участвует в импорте и не показывается в списках.
 */
export async function deactivateImportSource(id: string): Promise<ImportSource> {
  return repo.updateImportSource(id, {
    isActive: false,
    status: "PAUSED",
  });
}

/**
 * Активировать источник — выставляет isActive = true.
 */
export async function activateImportSource(id: string): Promise<ImportSource> {
  return repo.updateImportSource(id, {
    isActive: true,
    status: "ACTIVE",
  });
}

export async function getImportSourceDeletionSummary(
  sourceId: string,
): Promise<ImportSourceDeletionSummary> {
  const [runsCount, importedRecordsCount, reviewTasksCount] = await prisma.$transaction([
    prisma.importRun.count({ where: { sourceId } }),
    prisma.importedRecord.count({ where: { sourceId } }),
    prisma.importReviewTask.count({
      where: {
        importedRecord: {
          sourceId,
        },
      },
    }),
  ]);

  return {
    runsCount,
    importedRecordsCount,
    reviewTasksCount,
    hasDependencies: runsCount > 0 || importedRecordsCount > 0 || reviewTasksCount > 0,
  };
}

export async function deleteImportSourceHard(sourceId: string): Promise<ImportSourceDeletionSummary> {
  const source = await repo.findImportSourceById(sourceId);
  if (!source) {
    throw new Error("Source not found");
  }

  const summary = await getImportSourceDeletionSummary(sourceId);

  await prisma.$transaction([
    prisma.importReviewTask.deleteMany({
      where: {
        importedRecord: {
          sourceId,
        },
      },
    }),
    prisma.importedRecord.deleteMany({
      where: { sourceId },
    }),
    prisma.importRun.deleteMany({
      where: { sourceId },
    }),
    prisma.importSource.delete({
      where: { id: sourceId },
    }),
  ]);

  return summary;
}
