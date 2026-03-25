import prisma from "@/lib/prisma";

/** Плоский список: корни по order, под каждым — дети по order (макс. 2 уровня). */
export function orderSignalDefinitionsForDisplay<
  T extends { id: string; parentId: string | null; order: number },
>(flat: T[]): T[] {
  const roots = flat
    .filter((c) => c.parentId == null)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const childrenByParent = new Map<string, T[]>();
  for (const c of flat) {
    if (c.parentId == null) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
  for (const [, list] of childrenByParent) {
    list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }
  const out: T[] = [];
  const seen = new Set<string>();
  for (const r of roots) {
    out.push(r);
    seen.add(r.id);
    const kids = childrenByParent.get(r.id) ?? [];
    for (const k of kids) {
      out.push(k);
      seen.add(k.id);
    }
  }
  for (const c of flat) {
    if (!seen.has(c.id)) out.push(c);
  }
  return out;
}

export async function assertValidSignalParentIdOrNull(
  parentId: string | null,
): Promise<void> {
  if (parentId == null) return;
  const parent = await prisma.signalDefinition.findUnique({
    where: { id: parentId },
    select: { parentId: true },
  });
  if (!parent) {
    throw new Error("Parent not found");
  }
  if (parent.parentId != null) {
    throw new Error("Only a root signal can be a parent");
  }
}

export async function assertSignalCanBecomeChild(definitionId: string): Promise<void> {
  const n = await prisma.signalDefinition.count({
    where: { parentId: definitionId },
  });
  if (n > 0) {
    throw new Error("Remove or move sub-signals first");
  }
}
