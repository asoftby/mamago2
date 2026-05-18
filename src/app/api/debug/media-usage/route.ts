import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

/**
 * DEBUG ENDPOINT - Remove after debugging
 * GET /api/debug/media-usage?filename=IMG_1718.webp
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const activityTitle = searchParams.get("activityTitle");

    const debug: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    // 1. Find MediaAsset by filename
    if (filename) {
      const mediaAssets = await prisma.mediaAsset.findMany({
        where: {
          OR: [
            { filename: { contains: filename } },
            { originalName: { contains: filename } },
            { publicUrl: { contains: filename } },
            { storageKey: { contains: filename } },
          ],
        },
        select: {
          id: true,
          filename: true,
          originalName: true,
          publicUrl: true,
          storageKey: true,
          status: true,
          usages: {
            select: {
              id: true,
              entityType: true,
              entityId: true,
              field: true,
            },
          },
        },
      });

      debug.mediaAssets = mediaAssets;
      debug.mediaAssetsCount = mediaAssets.length;

      // Get MediaUsage count
      if (mediaAssets.length > 0) {
        const mediaId = mediaAssets[0].id;
        const usageCount = await prisma.mediaUsage.count({
          where: { mediaId },
        });
        debug.mediaUsageCount = usageCount;
      }
    }

    // 2. Find Activity by title
    if (activityTitle) {
      const activities = await prisma.activity.findMany({
        where: {
          title: { contains: activityTitle },
        },
        select: {
          id: true,
          title: true,
          coverImageId: true,
          coverImageUrl: true,
          images: {
            select: {
              id: true,
              url: true,
              sortOrder: true,
            },
          },
        },
        take: 5,
      });

      debug.activities = activities;
      debug.activitiesCount = activities.length;

      // Check MediaUsage for these activities
      if (activities.length > 0) {
        const activityIds = activities.map((a) => a.id);
        const mediaUsages = await prisma.mediaUsage.findMany({
          where: {
            entityType: "EVENT",
            entityId: { in: activityIds },
          },
          select: {
            id: true,
            mediaId: true,
            entityId: true,
            field: true,
            media: {
              select: {
                filename: true,
                originalName: true,
              },
            },
          },
        });

        debug.mediaUsagesForActivities = mediaUsages;
      }
    }

    // 3. Check schema structure
    const activitySample = await prisma.activity.findFirst({
      select: {
        id: true,
        coverImageId: true,
        coverImageUrl: true,
      },
    });

    debug.activitySchemaSample = activitySample;

    // 4. Check if MediaUsage table exists and has data
    const mediaUsageCount = await prisma.mediaUsage.count();
    debug.totalMediaUsageRecords = mediaUsageCount;

    // 5. Sample MediaUsage records
    const sampleUsages = await prisma.mediaUsage.findMany({
      take: 5,
      include: {
        media: {
          select: {
            filename: true,
            originalName: true,
          },
        },
      },
    });

    debug.sampleMediaUsages = sampleUsages;

    return NextResponse.json(debug, { status: 200 });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      {
        error: "Debug failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
