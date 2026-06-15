import "server-only";

import { SignalStatus, type SignalUsageType } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";

const DEFAULT_LIMIT = 12;

const signalSelect = {
  id: true,
  slug: true,
  title: true,
  order: true,
  icon: true,
} as const;

function mapSignalRow(row: {
  id: string;
  slug: string;
  title: string;
  order: number;
  icon: string | null;
}): PlanOnboardingSignalChip {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    order: row.order,
    icon: row.icon,
  };
}

/** Активные chips для корневой группы с заданным usageType. */
export async function getSignalsByUsageType(
  usageType: SignalUsageType,
  limit = DEFAULT_LIMIT,
): Promise<PlanOnboardingSignalChip[]> {
  const root = await prisma.signalDefinition.findFirst({
    where: {
      usageType,
      parentId: null,
      isActive: true,
      status: SignalStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!root) return [];

  const children = await prisma.signalDefinition.findMany({
    where: {
      parentId: root.id,
      isActive: true,
      status: SignalStatus.ACTIVE,
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    take: limit,
    select: signalSelect,
  });

  return children.map(mapSignalRow);
}

/** Разрешает title/slug для произвольных signal ids (legacy + plan). */
export async function resolveSignalChipsByIds(
  ids: string[],
): Promise<PlanOnboardingSignalChip[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const rows = await prisma.signalDefinition.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: signalSelect,
  });

  const byId = new Map(rows.map((row) => [row.id, mapSignalRow(row)]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((row): row is PlanOnboardingSignalChip => row != null);
}

export async function getPlanOnboardingSignals(options?: {
  limit?: number;
  resolveIds?: string[];
}) {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const [preferences, formats, resolved] = await Promise.all([
    getSignalsByUsageType("PLAN_ADULT_PREFERENCE", limit),
    getSignalsByUsageType("PLAN_LEISURE_FORMAT", limit),
    options?.resolveIds?.length
      ? resolveSignalChipsByIds(options.resolveIds)
      : Promise.resolve([]),
  ]);

  return { preferences, formats, resolved };
}
