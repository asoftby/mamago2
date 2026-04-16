import prisma from "@/lib/prisma";
import type { ImportReviewTask, ImportReviewTaskStatus, Prisma } from "@prisma/client";

export type CreateImportReviewTaskInput = Prisma.ImportReviewTaskCreateInput;
export type UpdateImportReviewTaskInput = Prisma.ImportReviewTaskUpdateInput;

export async function findImportReviewTasksByStatus(
  status: ImportReviewTaskStatus,
  params?: { limit?: number; offset?: number },
): Promise<ImportReviewTask[]> {
  return prisma.importReviewTask.findMany({
    where: { status },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: params?.limit ?? 50,
    skip: params?.offset ?? 0,
  });
}

export async function findImportReviewTaskById(id: string): Promise<ImportReviewTask | null> {
  return prisma.importReviewTask.findUnique({ where: { id } });
}

export async function findImportReviewTaskByRecordId(
  importedRecordId: string,
): Promise<ImportReviewTask | null> {
  return prisma.importReviewTask.findUnique({ where: { importedRecordId } });
}

export async function createImportReviewTask(
  data: CreateImportReviewTaskInput,
): Promise<ImportReviewTask> {
  return prisma.importReviewTask.create({ data });
}

export async function updateImportReviewTask(
  id: string,
  data: UpdateImportReviewTaskInput,
): Promise<ImportReviewTask> {
  return prisma.importReviewTask.update({ where: { id }, data });
}

export async function countPendingImportReviewTasks(): Promise<number> {
  return prisma.importReviewTask.count({ where: { status: "PENDING" } });
}
