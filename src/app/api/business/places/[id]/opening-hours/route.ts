/**
 * API endpoint for Place Opening Hours
 * GET - Get opening hours for a place
 * PUT - Update opening hours for a place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  mapToCreatePayload,
  mapToUpdatePayload,
  validateOpeningHours,
} from "@/lib/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { canEditPendingPlace } from "@/lib/permissions/placeEditPermissions";

/**
 * GET /api/business/places/[id]/opening-hours
 * Get opening hours for a place
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        createdByUserId: true,
        ownerBusinessId: true,
        openingHours: {
          include: {
            rules: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            exceptions: {
              include: {
                intervals: {
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (!(await canManagePlaceAsync(user, place))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ openingHours: place.openingHours });
  } catch (error) {
    console.error("[GET /api/business/places/[id]/opening-hours] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/places/[id]/opening-hours
 * Update opening hours for a place
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;
    const body = await req.json();
    const { data } = body as { data: OpeningHoursData | null };

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        createdByUserId: true,
        ownerBusinessId: true,
        openingHoursId: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const isAdminOrModerator = user.role === "ADMIN" || user.role === "MODERATOR";

    if (!isAdminOrModerator) {
      if (!(await canManagePlaceAsync(user, place))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (place.status === "PENDING" && !canEditPendingPlace(user.role)) {
        return NextResponse.json(
          {
            error: "PENDING_PLACE_REQUIRES_STAFF",
            message: "Pending places can only be edited by staff (ADMIN/MODERATOR) while under moderation review.",
          },
          { status: 403 }
        );
      }

      if (place.status === "PUBLISHED") {
        return NextResponse.json(
          {
            error: "Cannot edit opening hours for published place directly. Use revision API instead.",
            code: "USE_REVISION_API",
          },
          { status: 400 }
        );
      }
    }

    if (!data) {
      if (place.openingHoursId) {
        await prisma.openingHours.delete({
          where: { id: place.openingHoursId },
        });

        await prisma.place.update({
          where: { id: placeId },
          data: { openingHoursId: null },
        });
      }

      return NextResponse.json({
        success: true,
        openingHours: null,
      });
    }

    const validation = validateOpeningHours(data);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    let openingHours;

    if (place.openingHoursId) {
      const updatePayload = mapToUpdatePayload(data);
      openingHours = await prisma.openingHours.update({
        where: { id: place.openingHoursId },
        data: updatePayload,
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });
    } else {
      const createPayload = mapToCreatePayload(data);
      openingHours = await prisma.openingHours.create({
        data: createPayload,
        include: {
          rules: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          exceptions: {
            include: {
              intervals: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });

      await prisma.place.update({
        where: { id: placeId },
        data: { openingHoursId: openingHours.id },
      });
    }

    return NextResponse.json({
      success: true,
      openingHours,
    });
  } catch (error) {
    console.error("[PUT /api/business/places/[id]/opening-hours] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
