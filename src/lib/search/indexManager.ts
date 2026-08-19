import prisma from "@/lib/prisma";
import type { SearchIndexEntityType, SearchIndexStatus } from "@prisma/client";

interface IndexRecordParams {
  entityId: string;
  entityType: SearchIndexEntityType;
  searchable?: boolean;
}

/**
 * Create or update a search index record
 * Called automatically when content is published/updated
 */
export async function upsertIndexRecord(params: IndexRecordParams): Promise<void> {
  try {
    await prisma.searchIndexRecord.upsert({
      where: {
        entityId_entityType: {
          entityId: params.entityId,
          entityType: params.entityType,
        },
      },
      create: {
        entityId: params.entityId,
        entityType: params.entityType,
        searchable: params.searchable !== undefined ? params.searchable : true,
        status: "PENDING",
      },
      update: {
        searchable: params.searchable !== undefined ? params.searchable : true,
        status: "PENDING",
        error: null,
      },
    });

    // TODO: Trigger actual indexing job (Algolia, Meilisearch, etc.)
    // For now, we'll mark as indexed immediately
    await markAsIndexed(params.entityId, params.entityType);
  } catch (error) {
    console.error("Failed to upsert index record:", error);
    await markAsFailed(
      params.entityId,
      params.entityType,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Mark a record as successfully indexed
 */
export async function markAsIndexed(
  entityId: string,
  entityType: SearchIndexEntityType
): Promise<void> {
  try {
    await prisma.searchIndexRecord.update({
      where: {
        entityId_entityType: {
          entityId,
          entityType,
        },
      },
      data: {
        status: "INDEXED",
        indexedAt: new Date(),
        error: null,
      },
    });
  } catch (error) {
    console.error("Failed to mark as indexed:", error);
  }
}

/**
 * Mark a record as failed with error message
 */
export async function markAsFailed(
  entityId: string,
  entityType: SearchIndexEntityType,
  error: string
): Promise<void> {
  try {
    await prisma.searchIndexRecord.update({
      where: {
        entityId_entityType: {
          entityId,
          entityType,
        },
      },
      data: {
        status: "FAILED",
        error,
      },
    });
  } catch (err) {
    console.error("Failed to mark as failed:", err);
  }
}

/**
 * Remove a record from the index (when content is deleted)
 */
export async function removeFromIndex(
  entityId: string,
  entityType: SearchIndexEntityType
): Promise<void> {
  try {
    await prisma.searchIndexRecord.update({
      where: {
        entityId_entityType: {
          entityId,
          entityType,
        },
      },
      data: {
        searchable: false,
        status: "EXCLUDED",
      },
    });

    // TODO: Remove from actual search engine
  } catch (error) {
    console.error("Failed to remove from index:", error);
  }
}

/**
 * Reindex a specific record
 */
export async function reindexRecord(
  entityId: string,
  entityType: SearchIndexEntityType
): Promise<void> {
  await upsertIndexRecord({ entityId, entityType });
}

/**
 * Bulk reindex by entity type
 */
export async function bulkReindex(entityType: SearchIndexEntityType): Promise<void> {
  try {
    // Get all entities of this type
    let entityIds: string[] = [];

    switch (entityType) {
      case "PLACE":
        const places = await prisma.place.findMany({
          where: { status: "PUBLISHED" },
          select: { id: true },
        });
        entityIds = places.map((p) => p.id);
        break;

      case "EVENT":
        const activities = await prisma.activity.findMany({
          where: { status: "PUBLISHED" },
          select: { id: true },
        });
        entityIds = activities.map((a) => a.id);
        break;

      case "OFFER":
        const offers = await prisma.offer.findMany({
          where: { status: "PUBLISHED", archivedAt: null, place: { archivedAt: null } },
          select: { id: true },
        });
        entityIds = offers.map((o) => o.id);
        break;

      case "ROUTE":
        const routes = await prisma.route.findMany({
          where: { status: "PUBLISHED" },
          select: { id: true },
        });
        entityIds = routes.map((r) => r.id);
        break;

      case "ARTICLE":
        const articles = await prisma.article.findMany({
          where: { status: "PUBLISHED" },
          select: { id: true },
        });
        entityIds = articles.map((a) => a.id);
        break;
    }

    // Reindex all
    await Promise.all(
      entityIds.map((id) => upsertIndexRecord({ entityId: id, entityType }))
    );
  } catch (error) {
    console.error("Bulk reindex failed:", error);
  }
}

/**
 * Get index health stats
 */
export async function getIndexHealth() {
  const records = await prisma.searchIndexRecord.findMany({
    select: { status: true },
  });

  const total = records.length;
  const indexed = records.filter((r) => r.status === "INDEXED").length;
  const pending = records.filter((r) => r.status === "PENDING").length;
  const failed = records.filter((r) => r.status === "FAILED").length;
  const excluded = records.filter((r) => r.status === "EXCLUDED").length;

  return {
    total,
    indexed,
    pending,
    failed,
    excluded,
    healthScore: total > 0 ? Math.round((indexed / total) * 100) : 100,
  };
}
