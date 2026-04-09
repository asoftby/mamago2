/**
 * POST /api/business/activities-v2
 * Create new Activity (DRAFT)
 * 
 * GET /api/business/activities-v2
 * List my activities
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus, Prisma } from "@prisma/client";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  buildActivityManageWhereForUser,
  coalesceActivityBusinessIdFromPlace,
  getBusinessIdsUserCanAccess,
} from "@/lib/auth/activityAccess";
import { canManagePlaceAsync, getUserBusinessId } from "@/lib/auth/placeAccess";

/**
 * POST - Create new Activity in DRAFT status
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, placeId } = body;

    // Validate type
    if (!type || !Object.values(ActivityType).includes(type)) {
      return NextResponse.json(
        { error: "Invalid activity type" },
        { status: 400 }
      );
    }

    // Validate placeId requirement (required for all except ROUTE)
    if (type !== "ROUTE" && !placeId) {
      return NextResponse.json(
        { error: "placeId is required for this activity type" },
        { status: 400 }
      );
    }

    let resolvedBusinessId: string | null = null;

    // If placeId provided, verify ownership and inherit business from place
    if (placeId) {
      const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: { createdByUserId: true, ownerBusinessId: true },
      });

      if (!place) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }

      if (!(await canManagePlaceAsync(user, place))) {
        return NextResponse.json(
          { error: "You don't own this place" },
          { status: 403 }
        );
      }

      resolvedBusinessId = coalesceActivityBusinessIdFromPlace(place, null);
    } else if (type === "ROUTE") {
      resolvedBusinessId = await getUserBusinessId(user.id);
    }

    // Create activity with minimal required fields
    const activity = await prisma.activity.create({
      data: {
        ownerUserId: user.id,
        type,
        placeId: placeId || null,
        businessId: resolvedBusinessId,
        status: "DRAFT",
        title: "Новая активность",
        shortDesc: "",
        scheduleMode: "ONE_TIME", // Default, will be updated by user
        ageTags: [],
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET - List my activities
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const manageWhere =
      user.role === "ADMIN" || user.role === "MODERATOR"
        ? {}
        : buildActivityManageWhereForUser(
            user.id,
            await getBusinessIdsUserCanAccess(user.id),
          );

    const where: Prisma.ActivityWhereInput = {
      ...manageWhere,
    };

    if (status && Object.values(ContentStatus).includes(status as ContentStatus)) {
      where.status = status as ContentStatus;
    }

    if (type && Object.values(ActivityType).includes(type as ActivityType)) {
      where.type = type as ActivityType;
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1, // Just cover image for list
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("List activities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
