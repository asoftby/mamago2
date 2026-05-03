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
