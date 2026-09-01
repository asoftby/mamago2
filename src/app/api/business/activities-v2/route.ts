/** Business Activity v2 collection endpoint. */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ContentStatus, Prisma } from "@prisma/client";
import {
  buildActivityManageWhereForUser,
  coalesceActivityBusinessIdFromPlace,
  getBusinessIdsUserCanAccess,
} from "@/lib/auth/activityAccess";
import { canManagePlaceAsync, getUserBusinessId } from "@/lib/auth/placeAccess";
import {
  checkUserBusinessPermission,
  isPlatformContentStaff,
} from "@/server/permissions/business-permissions";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { type, placeId } = body;
    if (!type || !Object.values(ActivityType).includes(type)) {
      return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
    }
    if (type !== "ROUTE" && !placeId) {
      return NextResponse.json(
        { error: "placeId is required for this activity type" },
        { status: 400 },
      );
    }

    let resolvedBusinessId: string | null = null;
    if (placeId) {
      const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: { createdByUserId: true, ownerBusinessId: true },
      });
      if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
      if (!(await canManagePlaceAsync(user, place))) {
        return NextResponse.json({ error: "You don't own this place" }, { status: 403 });
      }
      resolvedBusinessId = coalesceActivityBusinessIdFromPlace(place, null);
    } else if (type === "ROUTE") {
      resolvedBusinessId = await getUserBusinessId(user.id);
    }

    if (!isPlatformContentStaff(user.role)) {
      if (!resolvedBusinessId) {
        return NextResponse.json({ error: "Business access required" }, { status: 403 });
      }
      if (!(await checkUserBusinessPermission(user, resolvedBusinessId, "content.create"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const activity = await prisma.activity.create({
      data: {
        ownerUserId: user.id,
        type,
        placeId: placeId || null,
        businessId: resolvedBusinessId,
        status: "DRAFT",
        title: "Новая активность",
        shortDesc: "",
        scheduleMode: "ONE_TIME",
        ageTags: [],
      },
      include: {
        place: { select: { id: true, title: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Create activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const businessIds = isPlatformContentStaff(user.role)
      ? []
      : await getBusinessIdsUserCanAccess(user.id);

    if (!isPlatformContentStaff(user.role) && businessIds.length === 0) {
      return NextResponse.json({ error: "Business access required" }, { status: 403 });
    }

    const manageWhere = isPlatformContentStaff(user.role)
      ? {}
      : buildActivityManageWhereForUser(user.id, businessIds);
    const where: Prisma.ActivityWhereInput = { ...manageWhere };

    if (status && Object.values(ContentStatus).includes(status as ContentStatus)) {
      where.status = status as ContentStatus;
    }
    if (type && Object.values(ActivityType).includes(type as ActivityType)) {
      where.type = type as ActivityType;
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        place: { select: { id: true, title: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("List activities error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
