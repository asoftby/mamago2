import { prisma } from "@/lib/prisma";

const MAX_PREFERENCES = 3;

async function preferenceChildIdSet(): Promise<Set<string> | null> {
  const root = await prisma.signalDefinition.findFirst({
    where: { slug: "preferences", parentId: null, isActive: true },
    select: { id: true },
  });
  if (!root) return null;
  const children = await prisma.signalDefinition.findMany({
    where: { parentId: root.id, isActive: true },
    select: { id: true },
  });
  return new Set(children.map((c) => c.id));
}

async function formatChildIdSet(): Promise<Set<string> | null> {
  const root = await prisma.signalDefinition.findFirst({
    where: { slug: "leisure-format", parentId: null, isActive: true },
    select: { id: true },
  });
  if (!root) return null;
  const children = await prisma.signalDefinition.findMany({
    where: { parentId: root.id, isActive: true },
    select: { id: true },
  });
  return new Set(children.map((c) => c.id));
}

export async function validatePreferenceSignalIds(
  ids: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  if (ids.length > MAX_PREFERENCES) {
    return { ok: false, error: `Не больше ${MAX_PREFERENCES} предпочтений` };
  }
  const allowed = await preferenceChildIdSet();
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
  const allowed = await formatChildIdSet();
  if (!allowed) {
    return { ok: false, error: "Справочник формата досуга не настроен" };
  }
  if (!allowed.has(id)) return { ok: false, error: "Неизвестный формат досуга" };
  return { ok: true, id };
}
