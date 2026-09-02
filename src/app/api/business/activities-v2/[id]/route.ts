/** Business Activity v2 resource endpoint. */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ScheduleMode, Prisma } from "@prisma/client";
import {
  canManageActivityById,
  coalesceActivityBusinessIdFromPlace,
} from "@/lib/auth/activityAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        place: { select: { id: true, title: true, lat: true, lng: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (!(await canManageActivityById(user, activity.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Get activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { status: true, businessId: true },
    });
    if (!existing) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.status === "PUBLISHED") {
      return NextResponse.json({ error: "Cannot edit published activity" }, { status: 400 });
    }

    const body = await req.json();
    const updateData: Prisma.ActivityUpdateInput = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.shortDesc !== undefined) updateData.shortDesc = body.shortDesc;
    if (body.description !== undefined) updateData.description = body.description;

    if (body.type !== undefined) {
      if (!Object.values(ActivityType).includes(body.type)) {
        return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
      }
      updateData.type = body.type;
    }

    if (body.scheduleMode !== undefined) {
      if (!Object.values(ScheduleMode).includes(body.scheduleMode)) {
        return NextResponse.json({ error: "Invalid schedule mode" }, { status: 400 });
      }
      updateData.scheduleMode = body.scheduleMode;
    }

    if (body.scheduleJson !== undefined) updateData.scheduleJson = body.scheduleJson;
    if (body.nextOccurrenceAt !== undefined) {
      updateData.nextOccurrenceAt = body.nextOccurrenceAt
        ? new Date(body.nextOccurrenceAt)
        : null;
    }

    if (body.ageTags !== undefined) {
      if (!Array.isArray(body.ageTags)) {
        return NextResponse.json({ error: "ageTags must be an array" }, { status: 400 });
      }
      updateData.ageTags = body.ageTags;
    }

    if (body.priceFrom !== undefined) updateData.priceFrom = body.priceFrom;
    if (body.priceTo !== undefined) updateData.priceTo = body.priceTo;
    if (body.priceText !== undefined) updateData.priceText = body.priceText;
    if (body.currency !== undefined) updateData.currency = body.currency;

    if (body.coverImageId !== undefined) {
      updateData.coverImage = body.coverImageId
        ? { connect: { id: body.coverImageId } }
        : { disconnect: true };
    }

    if (body.placeId !== undefined) {
      if (body.placeId) {
        const place = await prisma.place.findUnique({
          where: { id: body.placeId },
          select: { createdByUserId: true, ownerBusinessId: true },
        });
        if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
        if (!(await canManagePlaceAsync(user, place))) {
          return NextResponse.json({ error: "You don't own this place" }, { status: 403 });
        }

        updateData.place = { connect: { id: body.placeId } };
        const resolvedBusinessId = coalesceActivityBusinessIdFromPlace(
          place,
          existing.businessId,
        );
        if (resolvedBusinessId) {
          updateData.business = { connect: { id: resolvedBusinessId } };
        }
      } else {
        updateData.place = { disconnect: true };
      }
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        place: { select: { id: true, title: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (body.title !== undefined && typeof body.title === "string" && body.title.trim()) {
      await assignActivitySlugIfMissing(id, body.title.trim());
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Update activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await assertContentLifecycleOperationAllowed({
      contentType: "ACTIVITY",
      contentId: id,
      operation: "deleteDraft",
      status: activity.status,
      prisma,
    });
    await prisma.activity.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(lifecycleErrorResponsePayload(error), {
        status: error.statusCode,
      });
    }
    console.error("Delete activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
