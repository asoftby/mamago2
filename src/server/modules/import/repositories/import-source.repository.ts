import prisma from "@/lib/prisma";
import type { ImportSource, ImportSourceStatus, Prisma } from "@prisma/client";

export type CreateImportSourceInput = Prisma.ImportSourceCreateInput;
export type UpdateImportSourceInput = Prisma.ImportSourceUpdateInput;

export async function findAllImportSources(params?: {
  status?: ImportSourceStatus;
  cityId?: string;
  includeArchived?: boolean;
  isActive?: boolean;
}): Promise<ImportSource[]> {
  return prisma.importSource.findMany({
    where: {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.cityId ? { cityId: params.cityId } : {}),
      // По умолчанию скрываем архивированные
      ...(!params?.includeArchived ? { archivedAt: null } : {}),
      // По умолчанию показываем только активные
      ...(params?.isActive !== undefined ? { isActive: params.isActive } : { isActive: true }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findImportSourceById(id: string): Promise<ImportSource | null> {
  return prisma.importSource.findUnique({ where: { id } });
}

export async function findImportSourceBySlug(slug: string): Promise<ImportSource | null> {
  return prisma.importSource.findUnique({ where: { slug } });
}

export async function createImportSource(data: CreateImportSourceInput): Promise<ImportSource> {
  return prisma.importSource.create({ data });
}

export async function updateImportSource(
  id: string,
  data: UpdateImportSourceInput,
): Promise<ImportSource> {
  return prisma.importSource.update({ where: { id }, data });
}

export async function deleteImportSource(id: string): Promise<ImportSource> {
  return prisma.importSource.delete({ where: { id } });
}