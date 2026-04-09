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
