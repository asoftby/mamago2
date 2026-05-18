import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/api/pagination";
import type { SearchIndexEntityType, SearchIndexStatus, SearchIndexRecord } from "@prisma/client";

/**
 * GET /api/admin/search/index
 * Get search index records with stats
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as SearchIndexEntityType | null;
    const status = searchParams.get("status") as SearchIndexStatus | null;
    const searchable = searchParams.get("searchable");
    const { page, limit, skip } = parsePaginationParams(searchParams, { defaultLimit: 50 });

    // Build where clause
    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;
    if (searchable !== null && searchable !== undefined) {
      where.searchable = searchable === "true";
    }

    // Get records
    const records = await prisma.searchIndexRecord.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { indexedAt: "desc" },
      ],
      take: limit,
      skip,
    });

    // Get total count
    const total = await prisma.searchIndexRecord.count({ where });

    // Get stats
    const allRecords = await prisma.searchIndexRecord.findMany({
      select: {
        status: true,
        entityType: true,
      },
    });

    const stats = {
      total: allRecords.length,
      indexed: allRecords.filter((r) => r.status === "INDEXED").length,
      pending: allRecords.filter((r) => r.status === "PENDING").length,
      failed: allRecords.filter((r) => r.status === "FAILED").length,
      excluded: allRecords.filter((r) => r.status === "EXCLUDED").length,
      byType: {
        EVENT: allRecords.filter((r) => r.entityType === "EVENT").length,
        PLACE: allRecords.filter((r) => r.entityType === "PLACE").length,
        OFFER: allRecords.filter((r) => r.entityType === "OFFER").length,
        ROUTE: allRecords.filter((r) => r.entityType === "ROUTE").length,
        ARTICLE: allRecords.filter((r) => r.entityType === "ARTICLE").length,
      },
    };

    // Enrich records with entity data
    const enrichedRecords = await enrichRecordsWithEntityData(records);

    return NextResponse.json({
      success: true,
      data: {
        records: enrichedRecords,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("GET /api/admin/search/index error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Enrich records with entity title and URL
 */
async function enrichRecordsWithEntityData(records: SearchIndexRecord[]) {
  const enriched = await Promise.all(
    records.map(async (record) => {
      let entityTitle = "Unknown";
      let entityUrl = "#";

      try {
        switch (record.entityType) {
          case "PLACE":
            const place = await prisma.place.findUnique({
              where: { id: record.entityId },
              select: { title: true, slug: true },
            });
            if (place) {
              entityTitle = place.title;
              entityUrl = `/places/${place.slug}`;
            }
            break;

          case "EVENT":
            const activity = await prisma.activity.findUnique({
              where: { id: record.entityId },
              select: { title: true, slug: true },
            });
            if (activity) {
              entityTitle = activity.title;
              entityUrl = `/events/${activity.slug}`;
            }
            break;

          case "OFFER":
            const offer = await prisma.offer.findUnique({
              where: { id: record.entityId },
              select: { title: true, slug: true },
            });
            if (offer) {
              entityTitle = offer.title;
              entityUrl = `/offers/${offer.slug}`;
            }
            break;

          case "ROUTE":
            const route = await prisma.route.findUnique({
              where: { id: record.entityId },
              select: { title: true, slug: true },
            });
            if (route) {
              entityTitle = route.title;
              entityUrl = `/routes/${route.slug}`;
            }
            break;

          case "ARTICLE":
            const article = await prisma.article.findUnique({
              where: { id: record.entityId },
              select: { title: true, slug: true },
            });
            if (article) {
              entityTitle = article.title;
              entityUrl = `/blog/${article.slug}`;
            }
            break;
        }
      } catch (err) {
        console.error(`Failed to enrich ${record.entityType} ${record.entityId}:`, err);
      }

      return {
        ...record,
        entityTitle,
        entityUrl,
      };
    })
  );

  return enriched;
}
