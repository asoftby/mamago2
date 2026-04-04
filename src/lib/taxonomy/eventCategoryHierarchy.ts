import type { EventCategoryPublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";

/** Плоский список для UI: сначала корни по sortOrder, под каждым — дети по sortOrder. */
export function orderEventCategoriesForDisplay<
  T extends { id: string; parentId: string | null; sortOrder: number },
>(flat: T[]): T[] {
  const roots = flat
    .filter((c) => c.parentId == null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const childrenByParent = new Map<string, T[]>();
  for (const c of flat) {
    if (c.parentId == null) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
  for (const [, list] of childrenByParent) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
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

/** Родитель для новой/переносимой дочерней записи: только существующий корень. */
export async function assertValidParentIdOrNull(
  parentId: string | null,
  opts?: { childType?: EventCategoryPublicationType },
): Promise<void> {
  if (parentId == null) return;
  const parent = await prisma.eventCategory.findUnique({
    where: { id: parentId },
    select: { parentId: true, publicationType: true },
  });
  if (!parent) {
    throw new Error("Parent not found");
  }
  if (parent.parentId != null) {
    throw new Error("Only a root category can be a parent");
  }
  if (opts?.childType != null && parent.publicationType !== opts.childType) {
    throw new Error("Parent category type must match child type");
  }
}

/** Нельзя сделать подкатегорией узел, у которого уже есть дети (иначе уровень > 2). */
export async function assertCanBecomeChild(categoryId: string): Promise<void> {
  const n = await prisma.eventCategory.count({
    where: { parentId: categoryId },
  });
  if (n > 0) {
    throw new Error("Remove or move subcategories first");
  }
}
