import prisma from "@/lib/prisma";
import type { ImportedRecord, ImportReviewStatus, Prisma } from "@prisma/client";
import { ensureImportReviewTaskExists } from "../services/import-review-task.service";

export type CreateImportedRecordInput = Prisma.ImportedRecordCreateInput;
export type UpdateImportedRecordInput = Prisma.ImportedRecordUpdateInput;

export async function findImportedRecordsBySource(
  sourceId: string,
  params?: { reviewStatus?: ImportReviewStatus; limit?: number; offset?: number },
): Promise<ImportedRecord[]> {
  return prisma.importedRecord.findMany({
    where: {
      sourceId,
      ...(params?.reviewStatus ? { reviewStatus: params.reviewStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params?.limit ?? 50,
    skip: params?.offset ?? 0,
  });
}

export async function findImportedRecordById(id: string): Promise<ImportedRecord | null> {
  return prisma.importedRecord.findUnique({ where: { id } });
}

export async function findImportedRecordByExternalId(
  sourceId: string,
  externalId: string,
): Promise<ImportedRecord | null> {
  return prisma.importedRecord.findFirst({
    where: { sourceId, externalId },
  });
}

export async function findImportedRecordByContentHash(
  contentHash: string,
): Promise<ImportedRecord | null> {
  return prisma.importedRecord.findFirst({ where: { contentHash } });
}

export async function createImportedRecord(
  data: CreateImportedRecordInput,
): Promise<ImportedRecord> {
  const record = await prisma.importedRecord.create({ data });
  await ensureImportReviewTaskExists(record.id);
  return record;
}

export async function updateImportedRecord(
  id: string,
  data: UpdateImportedRecordInput,
): Promise<ImportedRecord> {
  return prisma.importedRecord.update({ where: { id }, data });
}

export async function countImportedRecordsByReviewStatus(
  sourceId: string,
): Promise<Record<ImportReviewStatus, number>> {
  const rows = await prisma.importedRecord.groupBy({
    by: ["reviewStatus"],
    where: { sourceId },
    _count: { id: true },
  });

  const result = {} as Record<ImportReviewStatus, number>;
  for (const row of rows) {
    result[row.reviewStatus] = row._count.id;
  }
  return result;
}
