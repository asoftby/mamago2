/**
 * ImportRecordService
 * Phase 1: интерфейс и базовые методы. Логика — Phase 2+.
 */

import type { ImportedRecord, ImportReviewStatus } from "@prisma/client";
import * as repo from "../repositories/imported-record.repository";

export async function getRecordsBySource(
  sourceId: string,
  params?: { reviewStatus?: ImportReviewStatus; limit?: number; offset?: number },
): Promise<ImportedRecord[]> {
  return repo.findImportedRecordsBySource(sourceId, params);
}

export async function getRecordById(id: string): Promise<ImportedRecord | null> {
  return repo.findImportedRecordById(id);
}

export async function getRecordStatusCounts(
  sourceId: string,
): Promise<Record<ImportReviewStatus, number>> {
  return repo.countImportedRecordsByReviewStatus(sourceId);
}

// TODO Phase 2: parse → normalize → match pipeline
export async function processRecord(_recordId: string): Promise<void> {
  throw new Error("Not implemented — Phase 2");
}
