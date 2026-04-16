import prisma from "@/lib/prisma";
import type { ImportRun, ImportRunStatus, Prisma } from "@prisma/client";

export type CreateImportRunInput = Prisma.ImportRunCreateInput;
export type UpdateImportRunInput = Prisma.ImportRunUpdateInput;

export async function findImportRunsBySource(
  sourceId: string,
  limit = 20,
): Promise<ImportRun[]> {
  return prisma.importRun.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function findImportRunById(id: string): Promise<ImportRun | null> {
  return prisma.importRun.findUnique({ where: { id } });
}

export async function findImportRunsByStatus(status: ImportRunStatus): Promise<ImportRun[]> {
  return prisma.importRun.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
}

export async function createImportRun(data: CreateImportRunInput): Promise<ImportRun> {
  return prisma.importRun.create({ data });
}

export async function updateImportRun(
  id: string,
  data: UpdateImportRunInput,
): Promise<ImportRun> {
  return prisma.importRun.update({ where: { id }, data });
}
