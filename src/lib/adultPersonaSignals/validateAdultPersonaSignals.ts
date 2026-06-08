import { prisma } from "@/lib/prisma";
import { SignalUsageType } from "@prisma/client";

const MAX_PREFERENCES = 3;

async function childIdsForPreferenceRoots(): Promise<Set<string> | null> {
  const roots = await prisma.signalDefinition.findMany({
    where: {
      parentId: null,
      isActive: true,
      OR: [
        { slug: "preferences" },
        { slug: "plan-adult-preference" },
        { usageType: SignalUsageType.PLAN_ADULT_PREFERENCE },
      ],
    },
    select: { id: true },
  });
  if (roots.length === 0) return null;

  const children = await prisma.signalDefinition.findMany({
    where: { parentId: { in: roots.map((root) => root.id) }, isActive: true },
    select: { id: true },
  });
  return new Set(children.map((child) => child.id));
}

async function childIdsForFormatRoots(): Promise<Set<string> | null> {
  const roots = await prisma.signalDefinition.findMany({
    where: {
      parentId: null,
      isActive: true,
      OR: [
        { slug: "leisure-format" },
        { slug: "plan-leisure-format" },
        { usageType: SignalUsageType.PLAN_LEISURE_FORMAT },
      ],
    },
    select: { id: true },
  });
  if (roots.length === 0) return null;

  const children = await prisma.signalDefinition.findMany({
    where: { parentId: { in: roots.map((root) => root.id) }, isActive: true },
    select: { id: true },
  });
  return new Set(children.map((child) => child.id));
}

export async function validatePreferenceSignalIds(
  ids: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (ids.length > MAX_PREFERENCES) {
    return { ok: false, error: `Не больше ${MAX_PREFERENCES} предпочтений` };
  }
  const allowed = await childIdsForPreferenceRoots();
  if (!allowed) {
    return { ok: false, error: "Справочник предпочтений не настроен" };
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return { ok: false, error: "Дубликаты в предпочтениях" };
    seen.add(id);
    if (!allowed.has(id)) return { ok: false, error: "Неизвестное предпочтение" };
  }
  return { ok: true, ids };
}

export async function validateLeisureFormatSignalId(
  id: string | null,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (id === null) return { ok: true, id: null };
  const allowed = await childIdsForFormatRoots();
  if (!allowed) {
    return { ok: false, error: "Справочник формата досуга не настроен" };
  }
  if (!allowed.has(id)) return { ok: false, error: "Неизвестный формат досуга" };
  return { ok: true, id };
}
