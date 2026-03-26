import type { SeoPage } from "@/lib/admin/seo/domain/types";
import { listAllEntityRows } from "@/lib/admin/seo/entities/service";

/**
 * Legacy entrypoint kept for compatibility with existing imports.
 * New implementation is provider-registry based.
 */
export async function getAllEntitySeoPages(): Promise<SeoPage[]> {
  const rows = await listAllEntityRows();
  return rows.map((r) => ({
    id: r.id,
    path: r.path,
    section: r.section,
    type: r.type,
    filtersSnapshot: r.filtersSnapshot,
    title: r.title,
    h1: r.h1,
    description: r.description,
    isIndexable: r.isIndexable,
    canonical: r.canonical,
    updatedAt: r.updatedAt,
    indexationStatus: r.indexationStatus,
  }));
}

